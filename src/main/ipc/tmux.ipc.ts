import { IpcMain, BrowserWindow } from 'electron'
import { tmuxManager } from '../services/TmuxManager'

export function register(ipcMain: IpcMain, _mainWindow: BrowserWindow): void {
  ipcMain.handle('tmux:isInstalled', () => tmuxManager.isInstalled())

  ipcMain.handle('tmux:createSession', (_event, payload: { name: string; cwd: string }) => {
    console.log('[Tmux] createSession:', payload.name, payload.cwd)
    return tmuxManager.createSession(payload.name, payload.cwd)
  })

  ipcMain.handle('tmux:killSession', (_event, payload: { name: string }) => {
    console.log('[Tmux] killSession:', payload.name)
    return tmuxManager.killSession(payload.name)
  })

  ipcMain.handle('tmux:listSessions', () => tmuxManager.listSessions())

  ipcMain.handle('tmux:hasSession', (_event, payload: { name: string }) =>
    tmuxManager.hasSession(payload.name)
  )

  ipcMain.handle(
    'tmux:splitH',
    (_event, payload: { name: string; cwd?: string; command?: string }) =>
      tmuxManager.splitH(payload.name, payload.cwd, payload.command)
  )

  ipcMain.handle(
    'tmux:splitV',
    (_event, payload: { name: string; cwd?: string; command?: string }) =>
      tmuxManager.splitV(payload.name, payload.cwd, payload.command)
  )

  ipcMain.handle(
    'tmux:sendKeys',
    (_event, payload: { name: string; keys: string; paneIndex?: number }) =>
      tmuxManager.sendKeys(payload.name, payload.keys, payload.paneIndex)
  )

  ipcMain.handle('tmux:listPanes', (_event, payload: { name: string }) =>
    tmuxManager.listPanes(payload.name)
  )

  ipcMain.handle('tmux:selectPane', (_event, payload: { name: string; paneIndex: number }) =>
    tmuxManager.selectPane(payload.name, payload.paneIndex)
  )

  ipcMain.handle(
    'tmux:setLayout',
    (
      _event,
      payload: {
        name: string
        layout: 'even-horizontal' | 'even-vertical' | 'main-horizontal' | 'main-vertical' | 'tiled'
      }
    ) => tmuxManager.setLayout(payload.name, payload.layout)
  )

  ipcMain.handle('tmux:killPane', (_event, payload: { name: string; paneIndex: number }) =>
    tmuxManager.killPane(payload.name, payload.paneIndex)
  )

  ipcMain.handle(
    'tmux:newWindow',
    (_event, payload: { name: string; windowName: string; cwd: string; command?: string }) => {
      console.log('[Tmux] newWindow:', payload.name, payload.windowName)
      return tmuxManager.newWindow(payload.name, payload.windowName, payload.cwd, payload.command)
    }
  )
}
