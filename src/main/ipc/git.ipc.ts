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

  ipcMain.handle('git:branch', async (_event, payload: { path: string }) => {
    try {
      return await gitService.getBranch(payload.path)
    } catch {
      return null
    }
  })

  ipcMain.handle('git:revertFile', async (_event, payload: { worktreePath: string; filePath: string }) => {
    await gitService.revertFile(payload.worktreePath, payload.filePath)
    return { success: true }
  })

  ipcMain.handle('git:revertAll', async (_event, payload: { worktreePath: string }) => {
    await gitService.revertAll(payload.worktreePath)
    return { success: true }
  })

  ipcMain.handle('git:commit', async (_event, payload: { worktreePath: string; message: string }) => {
    return gitService.commit(payload.worktreePath, payload.message)
  })

  ipcMain.handle('git:push', async (_event, payload: { worktreePath: string }) => {
    await gitService.push(payload.worktreePath)
    return { success: true }
  })

  ipcMain.handle('git:pull', async (_event, payload: { worktreePath: string }) => {
    await gitService.pull(payload.worktreePath)
    return { success: true }
  })
}
