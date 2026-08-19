import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { isRunnerKind, RUNNER_KINDS, type RunnerKind } from './runner';

export type AppearanceTheme = 'system' | 'light' | 'dark';

export interface DesktopSettings {
  host: string;
  port: number;
  token: string;
  runnerKind: RunnerKind;
  runnerBins: Partial<Record<RunnerKind, string>>;
  runnerConfigured: boolean;
  setupComplete: boolean;
  appearanceTheme: AppearanceTheme;
}

const DEFAULT_SETTINGS: DesktopSettings = {
  host: '127.0.0.1',
  port: 8799,
  token: '',
  runnerKind: 'codex',
  runnerBins: {},
  runnerConfigured: false,
  setupComplete: false,
  appearanceTheme: 'system'
};

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): DesktopSettings {
  const settings: DesktopSettings = { ...DEFAULT_SETTINGS, runnerBins: {} };
  let needsSave = false;
  try {
    const parsed = JSON.parse(readFileSync(settingsFile(), 'utf-8')) as Partial<DesktopSettings> & {
      accentHue?: unknown;
      backendMode?: unknown;
    };
    needsSave = (
      Object.prototype.hasOwnProperty.call(parsed, 'accentHue')
      || Object.prototype.hasOwnProperty.call(parsed, 'backendMode')
    );
    if (typeof parsed.host === 'string' && parsed.host.trim()) settings.host = parsed.host.trim();
    if (Number.isInteger(parsed.port) && parsed.port! > 0 && parsed.port! < 65536) {
      settings.port = parsed.port!;
    }
    if (typeof parsed.token === 'string' && parsed.token.trim()) settings.token = parsed.token.trim();
    if (isRunnerKind(parsed.runnerKind)) {
      settings.runnerKind = parsed.runnerKind;
      settings.runnerConfigured = true;
    }
    if (typeof parsed.runnerConfigured === 'boolean') {
      settings.runnerConfigured = parsed.runnerConfigured;
    }
    if (parsed.runnerBins && typeof parsed.runnerBins === 'object') {
      for (const kind of RUNNER_KINDS) {
        const raw = (parsed.runnerBins as Record<string, unknown>)[kind];
        if (typeof raw === 'string' && raw.trim()) settings.runnerBins[kind] = raw.trim();
      }
    }
    const legacyRunnerBin = (parsed as Partial<DesktopSettings> & { runnerBin?: unknown }).runnerBin;
    if (!settings.runnerBins.codex && typeof legacyRunnerBin === 'string' && legacyRunnerBin.trim()) {
      settings.runnerBins.codex = legacyRunnerBin.trim();
    }
    if (typeof parsed.setupComplete === 'boolean') settings.setupComplete = parsed.setupComplete;
    if (
      parsed.appearanceTheme === 'system'
      || parsed.appearanceTheme === 'light'
      || parsed.appearanceTheme === 'dark'
    ) {
      settings.appearanceTheme = parsed.appearanceTheme;
    }
  } catch {
    // First run or a corrupt settings file falls back to defaults.
  }
  if (!settings.token) {
    settings.token = randomBytes(32).toString('base64url');
    needsSave = true;
  }
  if (needsSave) saveSettings(settings);
  return settings;
}

export function saveSettings(settings: DesktopSettings): void {
  const file = settingsFile();
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(file, JSON.stringify(settings, null, 2), 'utf-8');
}

export function apiBaseUrl(settings: DesktopSettings): string {
  return `http://${settings.host}:${settings.port}`;
}

export function cockpitUrl(settings: DesktopSettings): string {
  return `${apiBaseUrl(settings)}/?token=${encodeURIComponent(settings.token)}`;
}
