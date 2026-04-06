import { IpcMain, BrowserWindow, dialog } from 'electron'
import { basename, join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { persistenceService } from '../services/PersistenceService'
import type { Worktree } from '@shared/types'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

export function register(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
  // Legacy: open workspace (kept for backward compat)
  ipcMain.handle('workspace:open', (_event, payload: { path: string }) => {
    const { path } = payload
    return persistenceService.saveWorkspace({ path, name: basename(path) })
  })

  // Add a workspace (persist to SQLite)
  ipcMain.handle('workspace:add', (_event, payload: { path: string }) => {
    const { path } = payload
    return persistenceService.saveWorkspace({ path, name: basename(path) })
  })

  // Remove a workspace by id
  ipcMain.handle('workspace:remove', (_event, payload: { id: string }) => {
    try {
      persistenceService.removeWorkspace(payload.id)
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  // List all workspaces
  ipcMain.handle('workspace:list', () => {
    return persistenceService.getWorkspaces()
  })

  ipcMain.handle('workspace:getRecent', () => {
    return persistenceService.getWorkspaces()
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  // Create a new git worktree
  ipcMain.handle(
    'worktree:create',
    async (
      _event,
      payload: { workspaceId: string; workspacePath: string; branch: string; name: string }
    ) => {
      const { workspaceId, workspacePath, branch, name } = payload
      const id = randomUUID()
      const worktreePath = join(workspacePath, '..', `${basename(workspacePath)}-${branch}`)
      await execFileAsync('git', ['worktree', 'add', '-b', branch, worktreePath], {
        cwd: workspacePath
      })
      const worktree: Worktree = {
        id,
        workspaceId,
        path: worktreePath,
        branch,
        name,
        isMain: false
      }
      return worktree
    }
  )

  // List all worktrees for a workspace
  ipcMain.handle(
    'worktree:list',
    async (_event, payload: { workspaceId: string; workspacePath: string }) => {
      const { workspaceId, workspacePath } = payload
      const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
        cwd: workspacePath
      })
      const worktrees: Worktree[] = []
      const blocks = stdout.trim().split('\n\n')
      for (const block of blocks) {
        if (!block.trim()) continue
        const lines = block.split('\n')
        const pathLine = lines.find((l) => l.startsWith('worktree '))
        const branchLine = lines.find((l) => l.startsWith('branch '))
        if (!pathLine) continue
        const path = pathLine.replace('worktree ', '').trim()
        const branch = branchLine
          ? branchLine.replace('branch refs/heads/', '').trim()
          : '(detached)'
        const isMain = path === workspacePath
        worktrees.push({
          id: path, // use path as stable id
          workspaceId,
          path,
          branch,
          name: isMain ? basename(workspacePath) : basename(path),
          isMain
        })
      }
      return worktrees
    }
  )

  // Remove a worktree
  ipcMain.handle(
    'worktree:remove',
    async (_event, payload: { workspaceId: string; worktreePath: string }) => {
      try {
        await execFileAsync('git', ['worktree', 'remove', payload.worktreePath])
        return { success: true }
      } catch {
        return { success: false }
      }
    }
  )
}
