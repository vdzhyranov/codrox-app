import { IpcMain, BrowserWindow } from 'electron'
import { subAgentWatcher } from '../services/SubAgentWatcher'
import { graphService } from '../services/graph/GraphService'
import { tokenUsageService } from '../services/TokenUsageService'

export function register(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
  ipcMain.handle('agents:list', (_event, payload: { workspacePath: string }) => {
    return subAgentWatcher.listAgents(payload.workspacePath)
  })

  ipcMain.handle('subagents:watch', (_event, payload: { workspacePath: string }) => {
    // Backfill token usage for agents already on disk before this watch session.
    const existing = subAgentWatcher.listAgents(payload.workspacePath)
    tokenUsageService.backfill(payload.workspacePath, existing)

    subAgentWatcher.start(payload.workspacePath, (newAgent) => {
      graphService.recordAgentSession(payload.workspacePath, newAgent)

      // Index token usage once the transcript has had a moment to be written.
      setTimeout(() => {
        const agents = subAgentWatcher.listAgents(payload.workspacePath)
        const entry = agents.find((a) => a.id === newAgent.id)
        if (entry) {
          tokenUsageService.indexAgent(payload.workspacePath, entry.id, entry.outputPath)
        }
      }, 5000)

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('subagents:new', {
          agentId: newAgent.id,
          task: newAgent.task,
        })
      }
    })
  })

  ipcMain.handle('subagents:unwatch', () => {
    subAgentWatcher.stop()
  })
}
