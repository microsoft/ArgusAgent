import AdmZip from 'adm-zip';
import { app, dialog } from 'electron';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { arch, hostname, platform, release } from 'node:os';
import { join } from 'node:path';
import { redactSensitiveText } from './redaction';
import type { Logger } from './types';

function safeRead(file: string): string | null {
  try {
    return readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}

export async function exportDiagnostics(log: Logger): Promise<string | null> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const result = await dialog.showSaveDialog({
    title: '导出 Argus 诊断包',
    defaultPath: join(app.getPath('downloads'), `Argus-diagnostics-${stamp}.zip`),
    filters: [{ name: 'ZIP', extensions: ['zip'] }]
  });
  if (result.canceled || !result.filePath) return null;

  const userData = app.getPath('userData');
  const tempDir = join(app.getPath('temp'), `argus-diagnostics-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  const settings = safeRead(join(userData, 'settings.json'));
  if (settings) {
    writeFileSync(join(tempDir, 'settings.json'), redactSensitiveText(settings), 'utf-8');
  }

  const backend = safeRead(join(userData, 'runtime', 'backend.json'));
  if (backend) {
    writeFileSync(join(tempDir, 'backend.json'), redactSensitiveText(backend), 'utf-8');
  }

  const desktopLog = join(userData, 'logs', 'desktop.log');
  if (existsSync(desktopLog)) {
    const raw = readFileSync(desktopLog, 'utf-8');
    writeFileSync(
      join(tempDir, 'desktop.log'),
      redactSensitiveText(raw.slice(-500_000)),
      'utf-8'
    );
  }

  writeFileSync(
    join(tempDir, 'diagnostics.json'),
    JSON.stringify(
      {
        appVersion: app.getVersion(),
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
        platform: platform(),
        release: release(),
        arch: arch(),
        hostname: hostname(),
        exportedAt: new Date().toISOString()
      },
      null,
      2
    ),
    'utf-8'
  );

  const zip = new AdmZip();
  for (const file of readdirSync(tempDir)) {
    zip.addLocalFile(join(tempDir, file), '', file);
  }
  zip.writeZip(result.filePath);
  rmSync(tempDir, { recursive: true, force: true });

  log.info(`diagnostics exported to ${result.filePath}`);
  return result.filePath;
}
