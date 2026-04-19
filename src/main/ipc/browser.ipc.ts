import { ipcMain, webContents, BrowserWindow } from 'electron'

export function register(_ipc: typeof ipcMain, mainWindow: BrowserWindow): void {
  let pendingTargetId: number | null = null

  // Renderer calls this BEFORE mounting the devtools webview.
  // We store the target so the next webview attachment is treated as the devtools host.
  ipcMain.handle('browser:prepare-devtools', (_event, payload: { targetId: number }) => {
    pendingTargetId = payload.targetId
    return true
  })

  // Catch newly-attached webviews BEFORE they navigate.
  // If we have a pending target, wire this fresh WebContents as its devtools host.
  mainWindow.webContents.on('did-attach-webview', (_event, wc) => {
    if (pendingTargetId !== null) {
      const targetId = pendingTargetId
      pendingTargetId = null

      const target = webContents.fromId(targetId)
      if (target) {
        target.setDevToolsWebContents(wc)
        target.openDevTools()
      }
    }
  })

  ipcMain.handle('browser:close-devtools', (_event, payload: { targetId: number }) => {
    const target = webContents.fromId(payload.targetId)
    if (target && target.isDevToolsOpened()) {
      target.closeDevTools()
    }
  })
}
