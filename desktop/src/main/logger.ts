import log from 'electron-log/main';
import { join } from 'node:path';
import { app } from 'electron';
import { installConsolePipeGuard } from './loggerSafety';

export function createLogger(): typeof log {
  installConsolePipeGuard(log.transports.console);
  log.initialize();
  if (app.isPackaged) {
    log.transports.console.level = false;
  }
  log.transports.file.resolvePathFn = () =>
    join(app.getPath('userData'), 'logs', 'desktop.log');
  log.transports.file.maxSize = 5 * 1024 * 1024;
  log.errorHandler.startCatching({
    showDialog: false,
    onError({ error }) {
      log.error('uncaught main-process error', error);
    }
  });
  return log;
}
