import * as pty from 'node-pty'
import type { IPty } from 'node-pty'
import { exec } from 'child_process'
import { claudeEnvManager } from './ClaudeEnvManager'
import { persistenceService } from './PersistenceService'
import type { WorkspaceSettings } from '@shared/types'

interface PTYSession {
  pty: IPty
  worktreeId: string
  workspaceId?: string
  type: 'claude' | 'terminal'
  /** Epoch ms of last data received from this PTY */
  lastOutputAt: number
  /** First-prompt capture state for claude sessions */
  promptCapture?: {
    buffer: string
    done: boolean
  }
}

class PTYManager {
  private sessions: Map<string, PTYSession> = new Map()
  private outputBuffers: Map<string, string[]> = new Map()
  private readonly MAX_BUFFER_BYTES = 128 * 1024
  private onDataCallback: ((id: string, data: string) => void) | null = null
  private onExitCallback: ((id: string, exitCode: number) => void) | null = null
  private onFirstPromptCallback:
    | ((id: string, worktreeId: string, prompt: string) => void)
    | null = null

  // Cached resolution of the claude binary path + full login PATH
  private claudeResolution: Promise<{ bin: string; path: string } | null> | null = null

  private resolveClaudeBin(): Promise<{ bin: string; path: string } | null> {
    if (!this.claudeResolution) {
      this.claudeResolution = new Promise((resolve) => {
        exec(
          "zsh -lc 'printf \"%s\\t%s\" \"$(which claude 2>/dev/null)\" \"$PATH\"'",
          { timeout: 8000 },
          (_err, stdout) => {
            const tab = stdout.indexOf('\t')
            if (tab < 0) { resolve(null); return }
            const bin = stdout.slice(0, tab).trim()
            const path = stdout.slice(tab + 1).trim()
            if (bin) {
              console.log('[PTYManager] resolved claude binary:', bin)
              resolve({ bin, path })
            } else {
              console.warn('[PTYManager] claude binary not found via login shell, will use prompt detection')
              resolve(null)
            }
          }
        )
      })
    }
    return this.claudeResolution
  }

  /** Kick off binary resolution eagerly at startup so it's ready by first pty:create */
  warmClaudeResolution(): void {
    this.resolveClaudeBin().catch(() => {})
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
      // PTY already running — caller will reattach, don't destroy
      return
    }

    const defaultShell = process.env.SHELL || '/bin/zsh'
    const shell = options.shell || defaultShell
    const isLoginCapable = /\/(zsh|bash)$/.test(shell)

    // For claude panels: try fast path — spawn claude directly without login shell startup.
    // Falls back to login+interactive shell with prompt detection if binary can't be resolved.
    let spawnArgs: string[]
    let extraEnv: Record<string, string> = {}
    let useFastPath = false

    if (options.type === 'claude' && !options.args && isLoginCapable) {
      const resolution = await this.resolveClaudeBin()
      if (resolution) {
        const escapedBin = resolution.bin.replace(/'/g, "'\\''")
        // Non-interactive shell runs claude directly — no login profile sourcing, no prompt wait
        spawnArgs = ['-c', `'${escapedBin}' --continue 2>/dev/null || '${escapedBin}'`]
        extraEnv = { PATH: resolution.path }
        useFastPath = true
      } else {
        spawnArgs = ['-il']
      }
    } else {
      spawnArgs = options.args || (isLoginCapable ? ['-il'] : [])
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

      // For claude panels using interactive shell fallback: detect the shell prompt
      // instead of a fixed timeout so we write the claude command as soon as the shell is ready.
      if (options.type === 'claude' && !useFastPath) {
        let claudeLaunched = false
        let accumulated = ''
        const promptPattern = /[$%>#]\s*$/m

        const promptListener = ptyProcess.onData((chunk) => {
          if (claudeLaunched) return
          accumulated += chunk
          if (accumulated.length > 512) accumulated = accumulated.slice(-512)
          if (promptPattern.test(accumulated)) {
            claudeLaunched = true
            promptListener.dispose()
            if (this.sessions.has(id)) {
              ptyProcess.write('claude --continue 2>/dev/null || claude\n')
            }
          }
        })

        // Safety fallback in case prompt detection misses (unusual prompts, etc.)
        setTimeout(() => {
          if (!claudeLaunched) {
            claudeLaunched = true
            try { promptListener.dispose() } catch { /* already disposed */ }
            if (this.sessions.has(id)) {
              ptyProcess.write('claude --continue 2>/dev/null || claude\n')
            }
          }
        }, 5000)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Failed to spawn PTY "${shell}": ${message}`)
      this.onExitCallback?.(id, -1)
    }
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id)
    if (session) {
      session.pty.write(data)
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id)
    if (session) {
      session.pty.resize(cols, rows)
    }
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
    const result: Array<{ id: string; worktreeId: string; type: 'claude' | 'terminal'; lastOutputAt: number }> = []
    for (const [id, session] of this.sessions) {
      result.push({ id, worktreeId: session.worktreeId, type: session.type, lastOutputAt: session.lastOutputAt })
    }
    return result
  }
}

export const ptyManager = new PTYManager()
