import { IpcMain, BrowserWindow } from 'electron'
import { linearService } from '../services/LinearService'
import type { CreateTaskInput } from '@shared/types/linear'

export function register(ipcMain: IpcMain, _mainWindow: BrowserWindow): void {
  ipcMain.handle('linear:status', async () => {
    return linearService.getAuthStatus()
  })

  ipcMain.handle('linear:setup', async (_event, payload: { apiKey: string }) => {
    return linearService.setup(payload.apiKey)
  })

  ipcMain.handle('linear:disconnect', async () => {
    await linearService.disconnect()
    return { success: true }
  })

  ipcMain.handle('linear:fetchTasks', async (_event, payload?: { teamId?: string }) => {
    return linearService.fetchTasks(payload?.teamId)
  })

  ipcMain.handle('linear:createTask', async (_event, payload: CreateTaskInput) => {
    return linearService.createTask(payload)
  })

  ipcMain.handle('linear:getTeams', async () => {
    return linearService.getTeams()
  })

  ipcMain.handle('linear:getBranchName', async (_event, payload: { taskId: string }) => {
    const branchName = await linearService.getBranchName(payload.taskId)
    return { branchName }
  })

  ipcMain.handle(
    'linear:linkWorktree',
    async (_event, payload: { worktreePath: string; taskId: string; taskIdentifier: string }) => {
      linearService.linkWorktree(payload.worktreePath, payload.taskId, payload.taskIdentifier)
      return { success: true }
    }
  )

  ipcMain.handle('linear:getLinkedTask', async (_event, payload: { worktreePath: string }) => {
    return linearService.getLinkedTask(payload.worktreePath)
  })

  ipcMain.handle('linear:unlinkWorktree', async (_event, payload: { worktreePath: string }) => {
    linearService.unlinkWorktree(payload.worktreePath)
    return { success: true }
  })
}
