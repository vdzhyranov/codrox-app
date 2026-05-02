import { IpcMain, BrowserWindow, dialog } from 'electron'
import { basename, join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { persistenceService } from '../services/PersistenceService'
import { workspaceSetup } from '../services/WorkspaceSetup'
import { worktreeWatcher } from '../services/WorktreeWatcher'
import { claudeEnvManager } from '../services/ClaudeEnvManager'
import { addManagedPath, getManagedPaths, removeManagedPath } from '../services/WorktreeRegistry'
import { subAgentWatcher } from '../services/SubAgentWatcher'
import type { Worktree, SessionData, WorkspaceSettings } from '@shared/types'
import { DEFAULT_WORKSPACE_SETTINGS } from '@shared/types'

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
    // Materialize the workspace's isolated Claude config dir (skills/hooks/commands).
    // Best-effort: failure here should not block adding a workspace.
    try {
      claudeEnvManager.materializeWorkspace(workspace.id, path)
    } catch (err) {
      console.warn('[workspace:add] materializeWorkspace failed:', err)
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
      payload: { workspaceId: string; workspacePath: string; branch: string; name: string; baseBranch?: string }
    ) => {
      const { workspaceId, workspacePath, branch, name, baseBranch } = payload
      const worktreePath = join(workspacePath, '..', `${basename(workspacePath)}-${branch}`)
      const opts = { cwd: workspacePath }

      // Fetch latest from origin so the new branch starts from up-to-date state
      await execFileAsync('git', ['fetch', 'origin'], opts).catch(() => {})

      // Determine start point: explicit baseBranch > origin/HEAD > local HEAD
      let startPoint: string | null = null
      if (baseBranch) {
        startPoint = `origin/${baseBranch}`
      } else {
        try {
          const { stdout } = await execFileAsync(
            'git',
            ['symbolic-ref', 'refs/remotes/origin/HEAD'],
            opts
          )
          // stdout is e.g. "refs/remotes/origin/main\n" → strip prefix
          startPoint = stdout.trim().replace('refs/remotes/', '')
        } catch {
          // origin/HEAD not set; fall through to null
        }
      }

      const addArgs = startPoint
        ? ['worktree', 'add', '-b', branch, worktreePath, startPoint]
        : ['worktree', 'add', '-b', branch, worktreePath]
      await execFileAsync('git', addArgs, opts)

      // Register this path as Codrox-managed so it can be distinguished from external worktrees
      try {
        const { stdout: commonDirOut } = await execFileAsync('git', ['rev-parse', '--git-common-dir'], opts)
        const raw = commonDirOut.trim()
        const gitCommonDir = raw.startsWith('/') ? raw : join(workspacePath, raw)
        addManagedPath(gitCommonDir, worktreePath)
      } catch {
        // best-effort
      }

      // Write MCP config into the new worktree so codrox-graph is available there.
      // Pass workspacePath as the --workspace arg so the MCP server opens the main
      // workspace graph (where all nodes live), not an empty worktree-scoped one.
      try {
        claudeEnvManager.writeMcpConfig('', workspacePath, worktreePath)
      } catch (err) {
        console.warn('[worktree:create] writeMcpConfig failed:', err)
      }
      // Use path as ID — consistent with worktree:list
      const worktree: Worktree = {
        id: worktreePath,
        workspaceId,
        path: worktreePath,
        branch,
        name,
        isMain: false,
        isExternal: false,
        hasActiveSession: false,
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

      // Load registry of Codrox-managed paths
      let managedPaths = new Set<string>()
      try {
        const { stdout: commonDirOut } = await execFileAsync(
          'git', ['rev-parse', '--git-common-dir'], { cwd: workspacePath }
        )
        const raw = commonDirOut.trim()
        const gitCommonDir = raw.startsWith('/') ? raw : join(workspacePath, raw)
        managedPaths = getManagedPaths(gitCommonDir)
      } catch {
        // best-effort
      }

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
        // Main worktree is always internal; linked worktrees are external if not in registry
        const isExternal = !isMain && !managedPaths.has(path)
        worktrees.push({
          id: path,
          workspaceId,
          path,
          branch,
          name: isMain ? basename(workspacePath) : basename(path),
          isMain,
          isExternal,
          hasActiveSession: subAgentWatcher.hasActiveSession(path),
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
      } catch {
        try {
          await execFileAsync('git', ['worktree', 'remove', '--force', '--force', payload.worktreePath], opts)
          await execFileAsync('git', ['worktree', 'prune'], opts).catch(() => {})
        } catch {
          return { success: false }
        }
      }
      // Unregister from Codrox registry
      try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--git-common-dir'], { cwd: payload.workspacePath })
        const raw = stdout.trim()
        const gitCommonDir = raw.startsWith('/') ? raw : join(payload.workspacePath, raw)
        removeManagedPath(gitCommonDir, payload.worktreePath)
      } catch {
        // best-effort
      }
      return { success: true }
    }
  )

  // Run WorkspaceSetup on an existing workspace path
  ipcMain.handle('workspace:setup', async (_event, payload: { path: string }) => {
    try {
      await workspaceSetup.setupWorkspace(payload.path)
      // Re-materialize MCP config in the isolated config dir
      const workspaces = persistenceService.getWorkspaces()
      const workspace = workspaces.find((w) => w.path === payload.path)
      if (workspace) {
        claudeEnvManager.materializeWorkspace(workspace.id, payload.path)
      }
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

  // Default branch preference — reads/writes through WorkspaceSettings (single source of truth)
  ipcMain.handle('workspace:getDefaultBranch', (_event, payload: { workspaceId: string }) => {
    const settings = persistenceService.getAppState<WorkspaceSettings>(`workspace:settings:${payload.workspaceId}`)
    if (settings?.git?.mainBranch !== undefined) return settings.git.mainBranch
    // Migrate from legacy key
    return persistenceService.getAppState<string>(`workspace:defaultBranch:${payload.workspaceId}`)
  })

  ipcMain.handle(
    'workspace:setDefaultBranch',
    (_event, payload: { workspaceId: string; branch: string }) => {
      const existing = persistenceService.getAppState<WorkspaceSettings>(`workspace:settings:${payload.workspaceId}`)
      const updated: WorkspaceSettings = {
        ...DEFAULT_WORKSPACE_SETTINGS,
        ...existing,
        git: { mainBranch: payload.branch || null }
      }
      persistenceService.setAppState(`workspace:settings:${payload.workspaceId}`, updated)
      return { success: true }
    }
  )

  ipcMain.handle('workspace:getSettings', (_event, payload: { workspaceId: string }) => {
    const settings = persistenceService.getAppState<WorkspaceSettings>(`workspace:settings:${payload.workspaceId}`)
    if (settings) {
      return { ...DEFAULT_WORKSPACE_SETTINGS, ...settings, git: { ...DEFAULT_WORKSPACE_SETTINGS.git, ...settings.git }, claude: { ...DEFAULT_WORKSPACE_SETTINGS.claude, ...settings.claude }, integrations: { ...DEFAULT_WORKSPACE_SETTINGS.integrations, ...settings.integrations } }
    }
    // Migrate legacy defaultBranch to new settings structure
    const legacyBranch = persistenceService.getAppState<string>(`workspace:defaultBranch:${payload.workspaceId}`)
    return { ...DEFAULT_WORKSPACE_SETTINGS, git: { mainBranch: legacyBranch ?? null } }
  })

  ipcMain.handle('workspace:saveSettings', (_event, payload: { workspaceId: string; settings: WorkspaceSettings }) => {
    persistenceService.setAppState(`workspace:settings:${payload.workspaceId}`, payload.settings)
    return { success: true }
  })

  ipcMain.handle(
    'workspace:listRemoteBranches',
    async (_event, payload: { workspacePath: string }) => {
      try {
        const { stdout } = await execFileAsync('git', ['branch', '-r'], {
          cwd: payload.workspacePath
        })
        return stdout
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.includes('->'))
          .map((l) => l.replace(/^origin\//, ''))
      } catch {
        return []
      }
    }
  )
}
