import { IpcMain } from 'electron'
import { claudeUsageService } from '../services/ClaudeUsageService'
import { claudeEnvManager } from '../services/ClaudeEnvManager'

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('claude:usageLimits', async (_, args?: { workspaceId?: string }) => {
    const workspaceId = args?.workspaceId ?? undefined
    const workspaceClaudeDir = workspaceId ? claudeEnvManager.claudeDir(workspaceId) : undefined
    return claudeUsageService.getLimits(workspaceId, workspaceClaudeDir)
  })
}
