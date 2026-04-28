import { IpcMain, BrowserWindow } from 'electron'
import { subAgentWatcher } from '../services/SubAgentWatcher'
import { graphService } from '../services/graph/GraphService'

export function register(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
  ipcMain.handle('agents:list', (_event, payload: { workspacePath: string }) => {
    return subAgentWatcher.listAgents(payload.workspacePath)
  })

  ipcMain.handle('subagents:watch', (_event, payload: { workspacePath: string }) => {
    subAgentWatcher.start(payload.workspacePath, (newAgent) => {
      graphService.recordAgentSession(payload.workspacePath, newAgent)
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
