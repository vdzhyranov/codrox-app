import type { IpcMain, BrowserWindow } from 'electron'
import { graphService } from '../services/graph/GraphService'
import { fileWatcher } from '../services/FileWatcher'
import type { GraphNodeType, GraphRelation } from '@shared/types/graph'

export function register(ipcMain: IpcMain, _mainWindow: BrowserWindow): void {
  // Auto-reindex on filesystem changes for any already-opened workspace.
  fileWatcher.addListener((_worktreeId, events) => {
    graphService.handleFileEvents(events)
  })


  ipcMain.handle('graph:reindex', (_e, payload: { workspacePath: string; scanPath?: string }) => {
    return graphService.reindex(payload.workspacePath, payload.scanPath)
  })

  ipcMain.handle('graph:search', (_e, payload: { workspacePath: string; q: string; limit?: number; nodeTypes?: GraphNodeType[] }) => {
    return graphService.search(payload.workspacePath, payload.q, payload.limit, payload.nodeTypes)
  })

  ipcMain.handle('graph:sweep', (_e, payload: { workspacePath: string }) => {
    return { deleted: graphService.sweepOrphans(payload.workspacePath) }
  })

  ipcMain.handle(
    'graph:neighbors',
    (_e, payload: {
      workspacePath: string
      nodeId: string
      relation?: GraphRelation
      direction?: 'out' | 'in' | 'both'
    }) => {
      return graphService.neighbors(
        payload.workspacePath,
        payload.nodeId,
        payload.relation,
        payload.direction ?? 'both'
      )
    }
  )

  ipcMain.handle('graph:stats', (_e, payload: { workspacePath: string }) => {
    return graphService.stats(payload.workspacePath)
  })
}
