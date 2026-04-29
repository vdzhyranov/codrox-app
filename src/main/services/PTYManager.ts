import * as pty from 'node-pty'
import type { IPty } from 'node-pty'
import { claudeEnvManager } from './ClaudeEnvManager'

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

  setCallbacks(
    onData: (id: string, data: string) => void,
    onExit: (id: string, exitCode: number) => void
  ): void {
    this.onDataCallback = onData
    this.onExitCallback = onExit
  }

  create(
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
  ): void {
    if (this.sessions.has(id)) {
      // PTY already running — caller will reattach, don't destroy
      return
    }

    const defaultShell = process.env.SHELL || '/bin/zsh'
    const shell = options.shell || defaultShell
    // Spawn as a login + interactive shell so the user's zsh/bash config
    // (PATH additions, nvm, aliases, prompt, claude on PATH) is sourced.
    // Without -il we'd get a bare environment that can't find user-installed CLIs.
    const isLoginCapable = /\/(zsh|bash)$/.test(shell)
    const args = options.args || (isLoginCapable ? ['-il'] : [])

    // If we know which workspace this PTY belongs to, materialize the
    // workspace's fake $HOME and inject the Claude-isolation env vars.
    let workspaceEnv: Record<string, string> = {}
    if (options.workspaceId) {
      try {
        claudeEnvManager.materializeWorkspaceHome(options.workspaceId)
        workspaceEnv = claudeEnvManager.getEnvForWorkspace(options.workspaceId)
      } catch (err) {
        console.warn('[PTYManager] failed to materialize workspace home:', err)
      }
    }

    const env = {
      ...process.env,
      ...workspaceEnv,
      ...options.env,
      TERM: 'xterm-256color',
      LANG: process.env.LANG || 'en_US.UTF-8',
      LC_ALL: process.env.LC_ALL || process.env.LANG || 'en_US.UTF-8'
    } as Record<string, string>

    try {
      const ptyProcess = pty.spawn(shell, args, {
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

      // For claude panels: launch claude inside the shell after it's ready
      // --continue resumes the most recent conversation for this directory
      if (options.type === 'claude') {
        setTimeout(() => {
          if (this.sessions.has(id)) {
            ptyProcess.write('claude --continue 2>/dev/null || claude\n')
          }
        }, 500)
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
