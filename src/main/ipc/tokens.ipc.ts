import { IpcMain } from 'electron'
import { graphService } from '../services/graph/GraphService'
import { subAgentWatcher } from '../services/SubAgentWatcher'
import { tokenUsageService } from '../services/TokenUsageService'

function backfillForPath(workspacePath: string): void {
  // No age limit — scan all history for token indexing purposes.
  const agents = subAgentWatcher.listAgents(workspacePath, Infinity)
  if (agents.length > 0) {
    tokenUsageService.backfill(workspacePath, agents)
  }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('tokens:getHistory', (_event, payload: { workspacePath: string }) => {
    backfillForPath(payload.workspacePath)
    return graphService.getTokenHistory(payload.workspacePath)
  })

  ipcMain.handle('tokens:getSummary', (_event, payload: { workspacePath: string }) => {
    backfillForPath(payload.workspacePath)
    return graphService.getTokenSummary(payload.workspacePath)
  })
}
