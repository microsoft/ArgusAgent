import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  Notification,
  shell,
  Tray,
  WebContentsView,
} from 'electron';
import { BackendSupervisor, type BackendStatus } from './backend';
import { exportDiagnostics } from './diagnostics';
import { createLogger } from './logger';
import { installApplicationMenu } from './menu';
import { LatestNavigation } from './navigation';
import { shouldHideWindowOnClose, shouldStopBackendOnQuit } from './windowLifecycle';
import { redactSensitiveText } from './redaction';
import {
  detectPiConfiguration,
  detectRunners,
  isRunnerKind,
  RUNNER_KINDS,
  RUNNER_LABELS,
  type RunnerKind
} from './runner';
import {
  resolveDesktopReleaseIdentity,
  runtimeIdentityFromStatus,
  type DesktopReleaseIdentity
} from './releaseIdentity';
import { hardenWebContents, hardenWindow } from './security';
import {
  cockpitUrl,
  loadSettings,
  saveSettings,
  type DesktopSettings
} from './settings';

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let settingsView: WebContentsView | null = null;
let supervisor: BackendSupervisor | null = null;
let desktopSettings: DesktopSettings | null = null;
let quitting = false;
let windowsSessionEnding = false;
let stopBackendAndQuitRequested = false;
let cockpitLoaded = false;
let tray: Tray | null = null;
const deliveredNotificationIds = new Set<string>();

interface DeliveryNotificationInput {
  deliveryId: string;
  title: string;
  summary: string;
  path?: string;
}

function normalizeDeliveryNotification(input: unknown): DeliveryNotificationInput | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  const deliveryId = typeof row.deliveryId === 'string' ? row.deliveryId.trim().slice(0, 300) : '';
  if (!deliveryId) return null;
  const title = typeof row.title === 'string' ? row.title.trim().slice(0, 240) : '';
  const summary = typeof row.summary === 'string' ? row.summary.trim().slice(0, 1_000) : '';
  const path = typeof row.path === 'string' ? row.path.trim().slice(0, 1_000) : '';
  return {
    deliveryId,
    title: title || 'Argus',
    summary,
    ...(path ? { path } : {})
  };
}

function rememberDeliveredNotification(id: string): boolean {
  if (deliveredNotificationIds.has(id)) return false;
  deliveredNotificationIds.add(id);
  while (deliveredNotificationIds.size > 100) {
    const oldest = deliveredNotificationIds.values().next().value;
    if (typeof oldest !== 'string') break;
    deliveredNotificationIds.delete(oldest);
  }
  return true;
}

function desktopIcon(): Electron.NativeImage {
  const path = app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(app.getAppPath(), 'resources', 'icon.ico');
  const icon = nativeImage.createFromPath(path);
  return icon.isEmpty() ? nativeImage.createFromPath(app.getPath('exe')) : icon;
}

function requestStopBackendAndQuit(): Promise<void> {
  if (quitting) return Promise.resolve();
  stopBackendAndQuitRequested = true;
  app.quit();
  return Promise.resolve();
}

function createTray(): void {
  if (tray) return;
  const icon = desktopIcon();
  if (icon.isEmpty()) {
    log.warn('desktop tray icon is unavailable; background backend remains launchable by reopening Argus');
    return;
  }
  tray = new Tray(icon);
  tray.setToolTip('Argus · 后台运行');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 Argus', click: () => void revealMainWindow() },
    { label: '隐藏窗口', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: '停止本地后端并退出', click: () => void requestStopBackendAndQuit() }
  ]));
  tray.on('click', () => void revealMainWindow());
}

const log = createLogger();
const mainNavigation = new LatestNavigation();
const settingsNavigation = new LatestNavigation();

function releaseIdentity(): DesktopReleaseIdentity {
  const development = process.env.ARGUS_DESKTOP_DEV === '1' || !app.isPackaged;
  return resolveDesktopReleaseIdentity({
    development,
    appVersion: app.getVersion(),
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    repoRoot: process.env.ARGUS_DESKTOP_REPO_ROOT
  });
}

function resolvedTheme(settings: DesktopSettings): 'light' | 'dark' {
  if (settings.appearanceTheme === 'light' || settings.appearanceTheme === 'dark') {
    return settings.appearanceTheme;
  }
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

function appearanceColors(settings: DesktopSettings): {
  background: string;
} {
  const dark = resolvedTheme(settings) === 'dark';
  return {
    background: dark ? '#0d0e12' : '#f9fafb'
  };
}

function applyWindowAppearance(window: BrowserWindow, settings: DesktopSettings): void {
  nativeTheme.themeSource = settings.appearanceTheme;
  window.setBackgroundColor(appearanceColors(settings).background);
}

function appearancePayload(settings: DesktopSettings): {
  theme: DesktopSettings['appearanceTheme'];
  resolvedTheme: 'light' | 'dark';
} {
  return {
    theme: settings.appearanceTheme,
    resolvedTheme: resolvedTheme(settings)
  };
}

function createWindow(): BrowserWindow {
  if (desktopSettings) nativeTheme.themeSource = desktopSettings.appearanceTheme;
  const colors = desktopSettings
    ? appearanceColors(desktopSettings)
    : { background: '#f9fafb' };
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: colors.background,
    title: 'Argus',
    // Keep Windows caption buttons in the native non-client frame. A hidden
    // title-bar overlay shares renderer coordinates with cockpit controls and
    // made the right-side file switcher impossible to click at some DPI sizes.
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  hardenWindow(window, () => desktopSettings?.port ?? 8799);
  if (desktopSettings) applyWindowAppearance(window, desktopSettings);
  window.once('ready-to-show', () => window.show());
  window.on('resize', syncSettingsViewBounds);
  window.on('query-session-end', () => {
    // Windows Restart Manager (used by NSIS during upgrades) and OS shutdown
    // must bypass close-to-tray. A normal WM_CLOSE still hides the window.
    windowsSessionEnding = true;
    quitting = true;
    tray?.destroy();
    tray = null;
  });
  window.on('session-end', () => {
    windowsSessionEnding = true;
    quitting = true;
    app.exit(0);
  });
  window.on('close', (event) => {
    if (!shouldHideWindowOnClose(quitting, windowsSessionEnding)) return;
    event.preventDefault();
    closeSettingsView();
    window.hide();
    log.info('desktop window hidden; owned backend remains available in the background');
  });
  window.on('closed', () => {
    mainNavigation.cancel();
    closeSettingsView();
    cockpitLoaded = false;
    mainWindow = null;
  });

  return window;
}

type RendererTarget = Pick<BrowserWindow, 'loadURL' | 'loadFile'>;

async function loadRenderer(target: RendererTarget, mode?: 'settings'): Promise<void> {
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL);
    if (mode) url.searchParams.set('mode', mode);
    await target.loadURL(url.toString());
  } else {
    await target.loadFile(
      join(__dirname, '../renderer/index.html'),
      mode ? { query: { mode } } : undefined
    );
  }
}

function mainWindowShowsCockpit(): boolean {
  if (!cockpitLoaded || !mainWindow || mainWindow.isDestroyed()) return false;
  try {
    const url = new URL(mainWindow.webContents.getURL());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function syncSettingsViewBounds(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !settingsView) return;
  const [width, height] = mainWindow.getContentSize();
  settingsView.setBounds({ x: 0, y: 0, width, height });
}

function closeSettingsView(): void {
  const view = settingsView;
  if (!view) return;
  settingsNavigation.cancel();
  settingsView = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.contentView.removeChildView(view);
    mainWindow.webContents.focus();
  }
  if (!view.webContents.isDestroyed()) view.webContents.close();
}

async function showSetupWizard(): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  // During first-run setup the launcher already owns the main window. Once the
  // workbench is open, place a dedicated WebContentsView over the whole window.
  // The workbench remains mounted underneath, so in-flight conversation state
  // survives while settings get true full-window visual coverage.
  if (!mainWindowShowsCockpit()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('argus:show-setup');
    return;
  }

  if (settingsView && !settingsView.webContents.isDestroyed()) {
    syncSettingsViewBounds();
    settingsView.webContents.focus();
    return;
  }

  const colors = desktopSettings
    ? appearanceColors(desktopSettings)
    : { background: '#f9fafb' };
  const view = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  settingsView = view;
  view.setBackgroundColor(colors.background);
  hardenWebContents(view.webContents, () => desktopSettings?.port ?? 8799);
  mainWindow.contentView.addChildView(view);
  syncSettingsViewBounds();
  view.webContents.once('destroyed', () => {
    if (settingsView === view) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.contentView.removeChildView(view);
      }
      settingsView = null;
    }
  });
  try {
    const outcome = await settingsNavigation.run(
      () => loadRenderer(view.webContents, 'settings')
    );
    if (outcome === 'loaded') view.webContents.focus();
  } catch (error) {
    closeSettingsView();
    throw error;
  }
}

function runnerBinsEqual(
  left: Partial<Record<RunnerKind, string>>,
  right: Partial<Record<RunnerKind, string>>
): boolean {
  return RUNNER_KINDS.every((kind) => (left[kind] ?? '') === (right[kind] ?? ''));
}

async function waitForBackendReady(timeoutMs = 30_000): Promise<boolean> {
  if (!supervisor || supervisor.currentStatus.state === 'ready') return true;
  return new Promise((resolveReady) => {
    let settled = false;
    const finish = (ready: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      supervisor?.off('status', onStatus);
      resolveReady(ready);
    };
    const onStatus = (status: BackendStatus): void => {
      if (status.state === 'ready') finish(true);
      if (status.state === 'error') finish(false);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    supervisor?.on('status', onStatus);
  });
}

function currentCockpitUrl(settings: DesktopSettings): string {
  const target = new URL(cockpitUrl(settings));
  if (!mainWindow || mainWindow.isDestroyed()) return target.toString();
  try {
    const current = new URL(mainWindow.webContents.getURL());
    for (const [name, value] of current.searchParams) {
      if (name !== 'token') target.searchParams.set(name, value);
    }
  } catch {
    // The launcher is a file URL and has no workbench query state to retain.
  }
  return target.toString();
}

function safeErrorDetail(error: unknown): string {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return redactSensitiveText(detail);
}

async function showLauncher(): Promise<boolean> {
  const target = mainWindow;
  if (!target || target.isDestroyed()) return false;
  cockpitLoaded = false;
  const outcome = await mainNavigation.run(() => loadRenderer(target));
  if (outcome === 'superseded') {
    log.verbose('launcher navigation superseded by a newer destination');
  }
  return outcome === 'loaded';
}

async function showCockpit(
  settings: DesktopSettings,
  url = cockpitUrl(settings)
): Promise<boolean> {
  const target = mainWindow;
  if (!target || target.isDestroyed()) return false;
  cockpitLoaded = true;
  try {
    const outcome = await mainNavigation.run(() => target.loadURL(url));
    if (outcome === 'superseded') {
      log.verbose('cockpit navigation superseded by a newer destination');
    }
    return outcome === 'loaded';
  } catch (error) {
    // A thrown navigation is still the latest intent (superseded runs never
    // throw), so it is safe to return ownership to the launcher.
    cockpitLoaded = false;
    throw error;
  }
}

/** Restore a hidden shell, or recreate one while preserving its backend. */
async function revealMainWindow(): Promise<void> {
  const existing = mainWindow;
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return;
  }
  mainWindow = createWindow();
  if (
    supervisor?.currentStatus.state === 'ready'
    && desktopSettings?.setupComplete
    && desktopSettings.runnerConfigured
  ) {
    await showCockpit(desktopSettings);
  } else {
    await showLauncher();
  }
}

function registerIpc(): void {
  ipcMain.handle('argus:get-status', () => supervisor?.currentStatus ?? {
    state: 'idle',
    message: '尚未启动'
  });
  ipcMain.handle('argus:open-logs', async () => {
    const logsDir = join(app.getPath('userData'), 'logs');
    return shell.openPath(logsDir);
  });
  ipcMain.handle('argus:open-data', async () => shell.openPath(app.getPath('userData')));
  ipcMain.handle('argus:restart-backend', async () => {
    await supervisor?.restart();
    return true;
  });
  ipcMain.handle('argus:get-setup', () => {
    if (!desktopSettings) return null;
    return {
      complete: desktopSettings.setupComplete,
      host: desktopSettings.host,
      port: desktopSettings.port,
      runnerKind: desktopSettings.runnerKind,
      runnerBins: desktopSettings.runnerBins,
      runnerConfigured: desktopSettings.runnerConfigured,
      detectedRunners: detectRunners(),
      piConfiguration: detectPiConfiguration(),
      releaseIdentity: releaseIdentity(),
      runtimeIdentity: runtimeIdentityFromStatus(supervisor?.currentStatus)
    };
  });
  ipcMain.handle('argus:get-appearance', () => {
    if (!desktopSettings) return null;
    return appearancePayload(desktopSettings);
  });
  ipcMain.handle('argus:request-setup', async () => {
    await showSetupWizard();
  });
  ipcMain.handle('argus:close-setup', (event) => {
    if (settingsView && event.sender === settingsView.webContents) closeSettingsView();
  });
  ipcMain.handle('argus:set-appearance', (_event, input: {
    theme?: unknown;
  }) => {
    if (!desktopSettings) return null;
    const theme = input?.theme === 'dark' ? 'dark' : 'light';
    if (desktopSettings.appearanceTheme !== theme) {
      desktopSettings = {
        ...desktopSettings,
        appearanceTheme: theme
      };
      saveSettings(desktopSettings);
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      applyWindowAppearance(mainWindow, desktopSettings);
    }
    if (settingsView) {
      settingsView.setBackgroundColor(appearanceColors(desktopSettings).background);
    }
    return appearancePayload(desktopSettings);
  });
  ipcMain.handle('argus:choose-runner', async (event, kind: unknown) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    if (!owner) return null;
    const runnerKind: RunnerKind = isRunnerKind(kind) ? kind : 'codex';
    const label = RUNNER_LABELS[runnerKind];
    const result = await dialog.showOpenDialog(owner, {
      title: `选择 ${label}`,
      properties: ['openFile'],
      filters: [
        { name: label, extensions: ['cmd', 'exe'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  ipcMain.handle(
    'argus:complete-setup',
    async (_event, input: {
      port?: unknown;
      runnerKind?: unknown;
      runnerBins?: unknown;
    }) => {
      if (!desktopSettings) return { ok: false, error: 'desktop settings not initialized' };
      const port = Number(input?.port);
      if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        return { ok: false, error: '端口需在 1024 - 65535 之间' };
      }
      const runnerKind: RunnerKind = isRunnerKind(input?.runnerKind) ? input.runnerKind : 'codex';
      const runnerBins: Partial<Record<RunnerKind, string>> = {
        ...desktopSettings.runnerBins
      };
      if (input?.runnerBins && typeof input.runnerBins === 'object') {
        for (const kind of RUNNER_KINDS) {
          const raw = (input.runnerBins as Record<string, unknown>)[kind];
          const value = typeof raw === 'string' ? raw.trim() : '';
          if (value) {
            runnerBins[kind] = value;
          } else {
            delete runnerBins[kind];
          }
        }
      }
      const previous = desktopSettings;
      const next: DesktopSettings = {
        ...previous,
        port,
        runnerKind,
        runnerBins,
        runnerConfigured: true,
        setupComplete: true
      };
      const runtimeChanged = (
        previous.port !== next.port
        || previous.runnerKind !== next.runnerKind
        || previous.runnerConfigured !== next.runnerConfigured
        || !runnerBinsEqual(previous.runnerBins, next.runnerBins)
      );
      const settingsChanged = (
        runtimeChanged
        || previous.setupComplete !== next.setupComplete
      );
      if (settingsChanged) saveSettings(next);
      desktopSettings = next;
      supervisor?.applySettings(next);

      if (runtimeChanged) {
        await supervisor?.restart();
        const ready = await waitForBackendReady();
        if (!ready) {
          const status = supervisor?.currentStatus;
          return {
            ok: false,
            error: status?.detail || status?.message || '本地后端未能重新启动'
          };
        }
      }

      if (
        previous.port !== next.port
        && mainWindowShowsCockpit()
        && mainWindow
        && !mainWindow.isDestroyed()
      ) {
        await showCockpit(next, currentCockpitUrl(next));
      }
      return { ok: true };
    }
  );
  ipcMain.handle('argus:export-diagnostics', () => exportDiagnostics(log));
  ipcMain.handle('argus:open-cockpit', async () => {
    if (cockpitLoaded || !mainWindow || mainWindow.isDestroyed() || !desktopSettings) return;
    try {
      await showCockpit(desktopSettings);
    } catch (error) {
      log.error('failed to open Argus cockpit', safeErrorDetail(error));
      try {
        await showLauncher();
      } catch (launcherError) {
        log.error('failed to restore launcher after cockpit navigation failure', safeErrorDetail(launcherError));
      }
    }
  });
  ipcMain.handle('argus:notify-delivery', (event, input: unknown) => {
    // The cockpit is a local authenticated document, but the main process
    // still treats delivery data as display-only untrusted input. It never
    // opens a path or executes a command from this IPC payload.
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
      return false;
    }
    const delivery = normalizeDeliveryNotification(input);
    if (!delivery || !rememberDeliveredNotification(delivery.deliveryId)) return false;
    const backgrounded = mainWindow.isMinimized() || !mainWindow.isFocused();
    if (!backgrounded || !Notification.isSupported()) return false;
    const notification = new Notification({
      title: `Argus · ${delivery.title}`,
      body: delivery.summary || '任务已完成，点击打开交付成果。',
      silent: false,
    });
    notification.on('click', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('argus:open-delivery', delivery);
    });
    notification.show();
    return true;
  });
  ipcMain.handle('argus:quit', () => app.quit());
}

async function startBackend(settings: DesktopSettings): Promise<void> {
  supervisor = new BackendSupervisor(settings, log);
  supervisor.on('status', (status: BackendStatus) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('argus:status', status);
      if (status.state === 'error' && cockpitLoaded) {
        // The Web workbench cannot surface a dead local service once its fetch
        // and WebSocket transports are gone. Return to the desktop launcher,
        // which shows the verified crash detail plus Retry/Settings actions.
        // All project progress is durable, so a successful retry reloads the
        // cockpit without inventing or discarding work.
        cockpitLoaded = false;
        closeSettingsView();
        void showLauncher().catch((error) => {
          log.error('failed to show backend recovery screen', safeErrorDetail(error));
        });
      }
    }
    if (
      status.state === 'ready'
      && !cockpitLoaded
      && desktopSettings?.setupComplete
      && desktopSettings.runnerConfigured
      && mainWindow
    ) {
      const currentSettings = desktopSettings;
      setTimeout(() => {
        if (
          !cockpitLoaded
          && currentSettings?.runnerConfigured
          && mainWindow
          && !mainWindow.isDestroyed()
        ) {
          void showCockpit(currentSettings).catch((error) => {
            log.error('failed to restore Argus cockpit', safeErrorDetail(error));
            void showLauncher().catch((launcherError) => {
              log.error('failed to restore launcher after cockpit navigation failure', safeErrorDetail(launcherError));
            });
          });
        }
      }, 6000);
    }
  });
  await supervisor.start();
}

app.on('second-instance', () => {
  void revealMainWindow().catch((error) => {
    log.error('failed to reveal background Argus window', safeErrorDetail(error));
  });
});

if (hasSingleInstanceLock) {
  void app.whenReady().then(async () => {
  const settings = loadSettings();
  desktopSettings = settings;
  registerIpc();
  createTray();
  mainWindow = createWindow();
  installApplicationMenu(
    {
      openLogs: async () => {
        const logsDir = join(app.getPath('userData'), 'logs');
        return shell.openPath(logsDir);
      },
      openData: async () => shell.openPath(app.getPath('userData')),
      restartBackend: async () => {
        await supervisor?.restart();
        return true;
      },
      exportDiagnostics: () => exportDiagnostics(log),
      openSetup: showSetupWizard,
      stopBackendAndQuit: requestStopBackendAndQuit
    },
    () => mainWindow
  );
  await showLauncher();
  await startBackend(settings);

  app.on('activate', () => {
    void revealMainWindow().catch((error) => {
      log.error('failed to restore background Argus window', safeErrorDetail(error));
    });
  });
  }).catch((error) => {
    const detail = safeErrorDetail(error);
    log.error('desktop bootstrap failed after navigation retries', detail);
    if (!quitting) {
      dialog.showErrorBox(
        'Argus 无法完成启动',
        `桌面资源连续加载失败。请重新启动 Argus；若问题仍然存在，请查看日志。\n\n${detail}`
      );
      app.quit();
    }
  });
}

app.on('before-quit', (event) => {
  if (quitting) return;
  quitting = true;
  tray?.destroy();
  tray = null;
  // Closing the Desktop shell normally detaches its verified backend so
  // long-running Argus work survives. Only the explicit stop-and-quit action
  // asks the supervisor to terminate that owned process tree.
  if (!shouldStopBackendOnQuit(stopBackendAndQuitRequested)) return;
  event.preventDefault();
  void (async () => {
    await supervisor?.stop();
    app.exit(0);
  })();
});

app.on('window-all-closed', () => {
  // A hidden/closed shell must not turn a 7×24 backend into a terminal task.
  // Relaunching Argus or clicking the tray recreates the window and adopts the
  // same authenticated local backend.
});
