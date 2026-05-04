import * as pty from 'node-pty'
import type { IPty } from 'node-pty'
import { claudeEnvManager } from './ClaudeEnvManager'
import { persistenceService } from './PersistenceService'
import { shellDetectionService } from './ShellDetectionService'
import type { WorkspaceSettings } from '@shared/types'

interface PTYSession {
  pty: IPty
  worktreeId: string
  workspaceId?: string
  type: 'claude' | 'terminal'
  /** Epoch ms of last data received from this PTY */
  lastOutputAt: number
}

const CLAUDE_NOT_FOUND_MSG = [
  '\r\n',
  '\x1b[31m✗ Claude CLI not found\x1b[0m\r\n',
  '\r\n',
  '\x1b[90mInstall it with:\x1b[0m\r\n',
  '  \x1b[97mnpm install -g @anthropic-ai/claude-code\x1b[0m\r\n',
  '\r\n',
  '\x1b[90mThen restart Codrox.\x1b[0m\r\n',
  '\r\n',
].join('')

class PTYManager {
  private sessions: Map<string, PTYSession> = new Map()
  private outputBuffers: Map<string, string[]> = new Map()
  private readonly MAX_BUFFER_BYTES = 128 * 1024
  private onDataCallback: ((id: string, data: string) => void) | null = null
  private onExitCallback: ((id: string, exitCode: number) => void) | null = null

  /** Kick off shell detection + Claude resolution eagerly at startup */
  warmClaudeResolution(preferredShell?: string): void {
    shellDetectionService.warm(preferredShell)
  }

  setCallbacks(
    onData: (id: string, data: string) => void,
    onExit: (id: string, exitCode: number) => void
  ): void {
    this.onDataCallback = onData
    this.onExitCallback = onExit
  }

  async create(
    id: string,
    options: {
      worktreeId: string
      workspaceId?: string
      cwd: string
      shell?: string
      args?: string[]
      type: 'claude' | 'terminal'
      env?: Record<string, string>
    }
  ): Promise<void> {
    if (this.sessions.has(id)) {
      // PTY already running — caller will reattach
      return
    }

    const shell = options.shell || process.env.SHELL || '/bin/zsh'

    let spawnArgs: string[]
    let extraEnv: Record<string, string> = {}
    let useFastPath = false

    if (options.type === 'claude' && !options.args) {
      const resolution = await shellDetectionService.resolveClaudeBin(shell)
      if (resolution) {
        const escapedBin = resolution.bin.replace(/'/g, "'\\''")
        spawnArgs = ['-c', `'${escapedBin}' --continue 2>/dev/null || '${escapedBin}'`]
        extraEnv = { PATH: resolution.path }
        useFastPath = true
      } else {
        // Claude not found — drop into interactive shell and show install instructions
        spawnArgs = ['-il']
        useFastPath = false
      }
    } else {
      spawnArgs = options.args || ['-il']
    }

    // Materialize workspace env vars (CLAUDE_CONFIG_DIR, hooks, etc.)
    let workspaceEnv: Record<string, string> = {}
    if (options.workspaceId) {
      try {
        const workspacePath = persistenceService
          .getWorkspaces()
          .find((w) => w.id === options.workspaceId)?.path
        claudeEnvManager.materializeWorkspace(options.workspaceId, workspacePath)
        const wsSettings = persistenceService.getAppState<WorkspaceSettings>(`workspace:settings:${options.workspaceId}`)
        const settingsMode = wsSettings?.claude?.settingsMode ?? 'workspace'
        workspaceEnv = claudeEnvManager.getEnvForWorkspace(options.workspaceId, settingsMode)
      } catch (err) {
        console.warn('[PTYManager] failed to materialize workspace home:', err)
      }
    }

    const env = {
      ...process.env,
      ...workspaceEnv,
      ...options.env,
      ...extraEnv,
      TERM: 'xterm-256color',
      LANG: process.env.LANG || 'en_US.UTF-8',
      LC_ALL: process.env.LC_ALL || process.env.LANG || 'en_US.UTF-8'
    } as Record<string, string>

    try {
      const ptyProcess = pty.spawn(shell, spawnArgs, {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: options.cwd,
        env
      })

      const session: PTYSession = {
        pty: ptyProcess,
        worktreeId: options.worktreeId,
        workspaceId: options.workspaceId,
        type: options.type,
        lastOutputAt: Date.now()
      }

      this.outputBuffers.set(id, [])

      ptyProcess.onData((data) => {
        session.lastOutputAt = Date.now()
        this.onDataCallback?.(id, data)
        const buf = this.outputBuffers.get(id)
        if (buf !== undefined) {
          buf.push(data)
          let size = buf.reduce((acc, s) => acc + s.length, 0)
          while (size > this.MAX_BUFFER_BYTES && buf.length > 1) {
            size -= buf[0].length
            buf.shift()
          }
        }
      })

      ptyProcess.onExit(({ exitCode }) => {
        this.sessions.delete(id)
        this.onExitCallback?.(id, exitCode)
      })

      this.sessions.set(id, session)

      if (options.type === 'claude' && !useFastPath) {
        // Claude not found — wait for shell prompt then show install instructions
        let handled = false
        let accumulated = ''
        const promptPattern = /[$%>#]\s*$/m

        const promptListener = ptyProcess.onData((chunk) => {
          if (handled) return
          accumulated += chunk
          if (accumulated.length > 512) accumulated = accumulated.slice(-512)
          if (promptPattern.test(accumulated)) {
            handled = true
            promptListener.dispose()
            if (this.sessions.has(id)) {
              ptyProcess.write(`printf '${CLAUDE_NOT_FOUND_MSG.replace(/'/g, "'\\''")}'\n`)
            }
          }
        })

        setTimeout(() => {
          if (!handled) {
            handled = true
            try { promptListener.dispose() } catch { /* already disposed */ }
            if (this.sessions.has(id)) {
              ptyProcess.write(`printf '${CLAUDE_NOT_FOUND_MSG.replace(/'/g, "'\\''")}'\n`)
            }
          }
        }, 5000)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[PTYManager] Failed to spawn PTY "${shell}": ${message}`)
      this.onExitCallback?.(id, -1)
    }
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id)
    if (session) session.pty.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id)
    if (session) session.pty.resize(cols, rows)
  }

  destroy(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      session.pty.kill()
      this.sessions.delete(id)
      this.outputBuffers.delete(id)
    }
  }

  getBuffer(id: string): string {
    return (this.outputBuffers.get(id) ?? []).join('')
  }

  destroyByWorktree(worktreeId: string): void {
    for (const [id, session] of this.sessions) {
      if (session.worktreeId === worktreeId) {
        session.pty.kill()
        this.sessions.delete(id)
      }
    }
  }

  getActiveCount(): number {
    return this.sessions.size
  }

  has(id: string): boolean {
    return this.sessions.has(id)
  }

  listActive(): Array<{ id: string; worktreeId: string; type: 'claude' | 'terminal'; lastOutputAt: number }> {
    return Array.from(this.sessions.entries()).map(([id, session]) => ({
      id,
      worktreeId: session.worktreeId,
      type: session.type,
      lastOutputAt: session.lastOutputAt,
    }))
  }
}

export const ptyManager = new PTYManager()
