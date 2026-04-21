import * as pty from 'node-pty'
import type { IPty } from 'node-pty'

interface PTYSession {
  pty: IPty
  worktreeId: string
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
      cwd: string
      shell?: string
      args?: string[]
      type: 'claude' | 'terminal'
      env?: Record<string, string>
    }
  ): void {
    if (this.sessions.has(id)) {
      this.destroy(id)
    }

    const defaultShell = process.env.SHELL || '/bin/zsh'
    const shell = options.shell || defaultShell
    const args = options.args || []

    const env = {
      ...process.env,
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
        type: options.type,
        lastOutputAt: Date.now()
      }

      ptyProcess.onData((data) => {
        session.lastOutputAt = Date.now()
        this.onDataCallback?.(id, data)
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
    }
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
