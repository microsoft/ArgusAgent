import { contextBridge, ipcRenderer } from 'electron';

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.dataset.argusDesktop = 'true';
  // Windows now keeps caption controls in the native non-client frame. The
  // launcher stylesheet uses this marker to remove its old overlay spacer.
  document.documentElement.dataset.argusDesktopNativeFrame = 'true';
});

export type RunnerKind =
  | 'codex'
  | 'claude'
  | 'copilot'
  | 'pi'
  | 'opencode'
  | 'grok'
  | 'qoder'
  | 'dsh';
export type AppearanceTheme = 'system' | 'light' | 'dark';

export interface DesktopAppearance {
  theme: AppearanceTheme;
  resolvedTheme: 'light' | 'dark';
}

export interface DesktopStatus {
  state: 'idle' | 'starting' | 'ready' | 'error' | 'stopped';
  message: string;
  detail?: string;
  pid?: number;
  url?: string;
}

export interface PiConfiguration {
  configDir: string;
  provider?: string;
  model?: string;
  qualifiedModel?: string;
}

export interface DesktopReleaseIdentity {
  packageVersion: string;
  releaseId: string;
  sourceDigest: string;
  distribution: 'development' | 'packaged';
}

export interface DesktopRuntimeIdentity {
  state: DesktopStatus['state'];
  pid?: number;
  url?: string;
}

export interface DesktopDeliveryNotification {
  deliveryId: string;
  title: string;
  summary: string;
  path?: string;
}

export interface DesktopSetup {
  complete: boolean;
  host: string;
  port: number;
  runnerKind: RunnerKind;
  runnerBins: Partial<Record<RunnerKind, string>>;
  runnerConfigured: boolean;
  detectedRunners: Partial<Record<RunnerKind, string>>;
  piConfiguration: PiConfiguration;
  releaseIdentity: DesktopReleaseIdentity;
  runtimeIdentity: DesktopRuntimeIdentity;
}

export interface SetupResult {
  ok: boolean;
  error?: string;
}

const api = {
  getStatus: (): Promise<DesktopStatus> => ipcRenderer.invoke('argus:get-status'),
  onStatus: (callback: (status: DesktopStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: DesktopStatus): void => {
      callback(status);
    };
    ipcRenderer.on('argus:status', listener);
    return () => ipcRenderer.removeListener('argus:status', listener);
  },
  getSetup: (): Promise<DesktopSetup> => ipcRenderer.invoke('argus:get-setup'),
  getAppearance: (): Promise<DesktopAppearance> => ipcRenderer.invoke('argus:get-appearance'),
  setAppearance: (appearance: { theme: 'light' | 'dark' }): Promise<DesktopAppearance> =>
    ipcRenderer.invoke('argus:set-appearance', appearance),
  showSetup: (): Promise<void> => ipcRenderer.invoke('argus:request-setup'),
  closeSetup: (): Promise<void> => ipcRenderer.invoke('argus:close-setup'),
  chooseRunner: (kind: RunnerKind): Promise<string | null> =>
    ipcRenderer.invoke('argus:choose-runner', kind),
  completeSetup: (input: {
    port: number;
    runnerKind: RunnerKind;
    runnerBins: Partial<Record<RunnerKind, string>>;
  }): Promise<SetupResult> => ipcRenderer.invoke('argus:complete-setup', input),
  openLogs: (): Promise<string> => ipcRenderer.invoke('argus:open-logs'),
  openData: (): Promise<string> => ipcRenderer.invoke('argus:open-data'),
  restartBackend: (): Promise<boolean> => ipcRenderer.invoke('argus:restart-backend'),
  exportDiagnostics: (): Promise<string | null> => ipcRenderer.invoke('argus:export-diagnostics'),
  openCockpit: (): Promise<void> => ipcRenderer.invoke('argus:open-cockpit'),
  notifyDelivery: (payload: DesktopDeliveryNotification): Promise<boolean> =>
    ipcRenderer.invoke('argus:notify-delivery', payload),
  onOpenDelivery: (
    callback: (payload: DesktopDeliveryNotification) => void,
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: DesktopDeliveryNotification): void => {
      callback(payload);
    };
    ipcRenderer.on('argus:open-delivery', listener);
    return () => ipcRenderer.removeListener('argus:open-delivery', listener);
  },
  onShowSetup: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('argus:show-setup', listener);
    return () => ipcRenderer.removeListener('argus:show-setup', listener);
  },
  onNewChat: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on('argus:new-chat', listener);
    return () => ipcRenderer.removeListener('argus:new-chat', listener);
  },
  quit: (): Promise<void> => ipcRenderer.invoke('argus:quit')
};

contextBridge.exposeInMainWorld('argusDesktop', api);
