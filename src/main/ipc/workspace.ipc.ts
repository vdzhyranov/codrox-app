import { IpcMain, BrowserWindow, dialog } from 'electron'
import { basename, join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { persistenceService } from '../services/PersistenceService'
import { workspaceSetup } from '../services/WorkspaceSetup'
import { worktreeWatcher } from '../services/WorktreeWatcher'
import { claudeEnvManager } from '../services/ClaudeEnvManager'
import type { Worktree, SessionData } from '@shared/types'

const execFileAsync = promisify(execFile)

export function register(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
  // Set up the worktree watcher callback once — fires worktree:changed to renderer
  worktreeWatcher.setCallback((workspaceId: string) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('worktree:changed', { workspaceId })
    }
  })
  // Legacy: open workspace (kept for backward compat)
  ipcMain.handle('workspace:open', (_event, payload: { path: string }) => {
    const { path } = payload
    return persistenceService.saveWorkspace({ path, name: basename(path) })
  })

  // Add a workspace (persist to SQLite) and set it up for Claude Code
  ipcMain.handle('workspace:add', async (_event, payload: { path: string }) => {
    const { path } = payload
    const workspace = persistenceService.saveWorkspace({ path, name: basename(path) })
    // Best-effort setup: create .claude/ dir and CLAUDE.md if missing
    workspaceSetup.setupWorkspace(path).catch(() => {})
    // Materialize the workspace's isolated Claude environment (fake $HOME with
    // codrox-managed skills/hooks/commands). Best-effort: failure here should
    // not block adding a workspace.
    try {
      claudeEnvManager.materializeWorkspaceHome(workspace.id)
    } catch (err) {
      console.warn('[workspace:add] materializeWorkspaceHome failed:', err)
    }
    return workspace
  })

  // Remove a workspace by id
  ipcMain.handle('workspace:remove', (_event, payload: { id: string }) => {
    try {
      persistenceService.removeWorkspace(payload.id)
      // Tear down the workspace's isolated Claude home so the next workspace
      // with the same id (unlikely, but possible after rebinding) starts fresh.
      claudeEnvManager.destroyWorkspaceHome(payload.id)
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

  // Start watching git metadata for worktree/branch changes
  ipcMain.handle(
    'worktree:watch',
    async (_event, payload: { workspaceId: string; workspacePath: string }) => {
      await worktreeWatcher.watch(payload.workspaceId, payload.workspacePath)
      return { success: true }
    }
  )

  // Stop watching a workspace's git metadata
  ipcMain.handle(
    'worktree:unwatch',
    async (_event, payload: { workspaceId: string }) => {
      await worktreeWatcher.unwatch(payload.workspaceId)
      return { success: true }
    }
  )

  // Create a new git worktree
  ipcMain.handle(
    'worktree:create',
    async (
      _event,
      payload: { workspaceId: string; workspacePath: string; branch: string; name: string }
    ) => {
      const { workspaceId, workspacePath, branch, name } = payload
      const worktreePath = join(workspacePath, '..', `${basename(workspacePath)}-${branch}`)
      await execFileAsync('git', ['worktree', 'add', '-b', branch, worktreePath], {
        cwd: workspacePath
      })
      // Use path as ID — consistent with worktree:list
      const worktree: Worktree = {
        id: worktreePath,
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
    async (_event, payload: { workspaceId: string; workspacePath: string; worktreePath: string }) => {
      const opts = { cwd: payload.workspacePath }
      try {
        await execFileAsync('git', ['worktree', 'remove', '--force', payload.worktreePath], opts)
        await execFileAsync('git', ['worktree', 'prune'], opts).catch(() => {})
        return { success: true }
      } catch {
        try {
          await execFileAsync('git', ['worktree', 'remove', '--force', '--force', payload.worktreePath], opts)
          await execFileAsync('git', ['worktree', 'prune'], opts).catch(() => {})
          return { success: true }
        } catch {
          return { success: false }
        }
      }
    }
  )

  // Run WorkspaceSetup on an existing workspace path
  ipcMain.handle('workspace:setup', async (_event, payload: { path: string }) => {
    try {
      await workspaceSetup.setupWorkspace(payload.path)
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  // Read CLAUDE.md from a workspace
  ipcMain.handle('workspace:readClaudeMd', (_event, payload: { path: string }) => {
    return workspaceSetup.readClaudeMd(payload.path)
  })

  // Write CLAUDE.md to a workspace
  ipcMain.handle('workspace:writeClaudeMd', (_event, payload: { path: string; content: string }) => {
    try {
      workspaceSetup.writeClaudeMd(payload.path, payload.content)
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  // Return detected project info for a workspace
  ipcMain.handle('workspace:getProjectInfo', async (_event, payload: { path: string }) => {
    try {
      return await workspaceSetup.detectProjectInfo(payload.path)
    } catch {
      return null
    }
  })

  // Session persistence
  ipcMain.handle('session:save', (_event, payload: SessionData) => {
    persistenceService.saveSession(payload)
    return { success: true }
  })

  ipcMain.handle('session:load', () => {
    return persistenceService.loadSession()
  })
}
