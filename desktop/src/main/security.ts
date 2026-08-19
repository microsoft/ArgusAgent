import { shell, type BrowserWindow, type WebContents } from 'electron';

function isAllowedLocalUrl(url: string, port: number): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:') return false;
    if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') return false;
    return Number(parsed.port) === port;
  } catch {
    return false;
  }
}

export function hardenWebContents(contents: WebContents, port: number | (() => number)): void {
  const getPort = (): number => (typeof port === 'function' ? port() : port);

  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedLocalUrl(url, getPort())) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    const isLocalFile = url.startsWith('file://');
    if (!isLocalFile && !isAllowedLocalUrl(url, getPort())) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

export function hardenWindow(window: BrowserWindow, port: number | (() => number)): void {
  hardenWebContents(window.webContents, port);
}
