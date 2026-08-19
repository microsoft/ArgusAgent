import { app, BrowserWindow, dialog, Menu } from 'electron';

export interface MenuActions {
  openLogs(): Promise<string>;
  openData(): Promise<string>;
  restartBackend(): Promise<boolean>;
  exportDiagnostics(): Promise<string | null>;
  openSetup(): Promise<void>;
  stopBackendAndQuit(): Promise<void>;
}

export function installApplicationMenu(
  actions: MenuActions,
  getWindow: () => BrowserWindow | null
): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => void actions.openSetup()
        },
        { type: 'separator' },
        {
          label: '新建对话',
          accelerator: 'CmdOrCtrl+N',
          click: () => getWindow()?.webContents.send('argus:new-chat')
        },
        { type: 'separator' },
        {
          label: '打开日志目录',
          click: () => void actions.openLogs()
        },
        {
          label: '打开数据目录',
          click: () => void actions.openData()
        },
        { type: 'separator' },
        {
          label: '关闭窗口并在后台继续',
          click: () => getWindow()?.hide()
        },
        {
          label: '退出桌面界面（后台继续）',
          click: () => app.quit()
        },
        {
          label: '停止本地后端并退出',
          click: () => void actions.stopBackendAndQuit()
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭窗口' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '重启后端',
          click: () => void actions.restartBackend()
        },
        {
          label: '导出诊断包',
          click: () => void actions.exportDiagnostics()
        },
        { type: 'separator' },
        {
          label: '关于 Argus',
          click: () => void showAbout()
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function showAbout(): void {
  void dialog.showMessageBox({
    type: 'info',
    title: '关于 Argus',
    message: `Argus ${app.getVersion()}`,
    detail: [
      `Electron ${process.versions.electron}`,
      `Chromium ${process.versions.chrome}`,
      `Node ${process.versions.node}`,
      `${process.platform} ${process.arch}`
    ].join('\n')
  });
}
