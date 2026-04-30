import { IpcMain } from 'electron'
import { claudeUsageService } from '../services/ClaudeUsageService'

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('claude:usageLimits', async () => {
    return claudeUsageService.getLimits()
  })
}
