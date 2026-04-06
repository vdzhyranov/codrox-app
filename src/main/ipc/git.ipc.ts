import { IpcMain, BrowserWindow } from 'electron'
import { gitService } from '../services/GitService'

export function register(ipcMain: IpcMain, _mainWindow: BrowserWindow): void {
  ipcMain.handle('git:status', async (_event, payload: { worktreePath: string }) => {
    return gitService.getStatus(payload.worktreePath)
  })

  ipcMain.handle('git:diff', async (_event, payload: { worktreePath: string; filePath: string }) => {
    const diff = await gitService.getDiff(payload.worktreePath, payload.filePath)
    return { diff }
  })
}
