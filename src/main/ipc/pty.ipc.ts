import { IpcMain, BrowserWindow, shell } from 'electron'
import { ptyManager } from '../services/PTYManager'

export function register(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
  ptyManager.setCallbacks(
    (id, data) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:output', { id, data })
      }
    },
    (id, exitCode) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:exit', { id, exitCode })
      }
    }
  )

  ipcMain.handle('pty:create', (_event, payload: {
    id: string
    worktreeId: string
    workspaceId?: string
    cwd: string
    shell?: string
    args?: string[]
    type: 'claude' | 'terminal'
  }) => {
    console.log('[PTY] Creating:', payload.id, payload.type, payload.cwd, payload.workspaceId ?? '(no workspace)')
    ptyManager.create(payload.id, {
      worktreeId: payload.worktreeId,
      workspaceId: payload.workspaceId,
      cwd: payload.cwd,
      shell: payload.shell,
      args: payload.args,
      type: payload.type
    })
  })

  ipcMain.handle('pty:write', (_event, payload: { id: string; data: string }) => {
    console.log('[PTY] Write to:', payload.id, JSON.stringify(payload.data).slice(0, 30))
    ptyManager.write(payload.id, payload.data)
  })

  ipcMain.handle('pty:resize', (_event, payload: { id: string; cols: number; rows: number }) => {
    ptyManager.resize(payload.id, payload.cols, payload.rows)
  })

  ipcMain.handle('pty:destroy', (_event, payload: { id: string }) => {
    ptyManager.destroy(payload.id)
  })

  ipcMain.handle('pty:listActive', () => {
    return ptyManager.listActive()
  })

  ipcMain.handle('shell:openExternal', (_event, payload: { url: string }) => {
    shell.openExternal(payload.url)
  })

  ipcMain.handle('shell:openPath', (_event, payload: { path: string }) => {
    shell.openPath(payload.path)
  })
}
