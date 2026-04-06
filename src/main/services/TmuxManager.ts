import { execFile } from 'child_process'
import { promisify } from 'util'
import { basename, join } from 'path'
import { existsSync } from 'fs'

const execFileAsync = promisify(execFile)

// Find the codrox tmux config file
function getConfigPath(): string | null {
  // In dev: resources/codrox.tmux.conf relative to project root
  const devPath = join(__dirname, '..', '..', '..', 'resources', 'codrox.tmux.conf')
  if (existsSync(devPath)) return devPath
  // In production: resources directory next to the app
  const prodPath = join(__dirname, '..', '..', 'resources', 'codrox.tmux.conf')
  if (existsSync(prodPath)) return prodPath
  return null
}

export interface TmuxSessionInfo {
  name: string
  windows: number
  attached: boolean
}

export interface TmuxPaneInfo {
  index: number
  title: string
  active: boolean
  pid: number
}

class TmuxManager {
  private async exec(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('tmux', args)
    return stdout.trim()
  }

  async isInstalled(): Promise<boolean> {
    try {
      await this.exec(['-V'])
      return true
    } catch {
      return false
    }
  }

  async createSession(sessionName: string, cwd: string): Promise<void> {
    const name = this.sanitizeName(sessionName)
    const configPath = getConfigPath()
    try {
      const args = ['new-session', '-d', '-s', name, '-c', cwd]
      if (configPath) {
        // Source our config after session creation
        await this.exec(args)
        await this.exec(['source-file', configPath]).catch(() => {})
      } else {
        await this.exec(args)
      }
    } catch (err) {
      console.error(`[TmuxManager] createSession failed for "${name}":`, err)
      throw err
    }
  }

  async killSession(sessionName: string): Promise<void> {
    const name = this.sanitizeName(sessionName)
    try {
      await this.exec(['kill-session', '-t', name])
    } catch (err) {
      console.error(`[TmuxManager] killSession failed for "${name}":`, err)
    }
  }

  async listSessions(): Promise<TmuxSessionInfo[]> {
    try {
      const output = await this.exec([
        'list-sessions',
        '-F',
        '#{session_name}:#{session_windows}:#{session_attached}'
      ])
      if (!output) return []
      return output.split('\n').map((line) => {
        const [name, windows, attached] = line.split(':')
        return {
          name,
          windows: parseInt(windows, 10) || 0,
          attached: attached === '1'
        }
      })
    } catch {
      return []
    }
  }

  async hasSession(sessionName: string): Promise<boolean> {
    const name = this.sanitizeName(sessionName)
    try {
      await this.exec(['has-session', '-t', name])
      return true
    } catch {
      return false
    }
  }

  async splitH(sessionName: string, cwd?: string, command?: string): Promise<void> {
    const name = this.sanitizeName(sessionName)
    try {
      const args = ['split-window', '-h', '-t', name]
      if (cwd) {
        args.push('-c', cwd)
      }
      if (command) {
        args.push(command)
      }
      await this.exec(args)
    } catch (err) {
      console.error(`[TmuxManager] splitH failed for "${name}":`, err)
      throw err
    }
  }

  async splitV(sessionName: string, cwd?: string, command?: string): Promise<void> {
    const name = this.sanitizeName(sessionName)
    try {
      const args = ['split-window', '-v', '-t', name]
      if (cwd) {
        args.push('-c', cwd)
      }
      if (command) {
        args.push(command)
      }
      await this.exec(args)
    } catch (err) {
      console.error(`[TmuxManager] splitV failed for "${name}":`, err)
      throw err
    }
  }

  async sendKeys(sessionName: string, keys: string, paneIndex?: number): Promise<void> {
    const name = this.sanitizeName(sessionName)
    const target = paneIndex !== undefined ? `${name}:${paneIndex}` : name
    try {
      await this.exec(['send-keys', '-t', target, keys, 'Enter'])
    } catch (err) {
      console.error(`[TmuxManager] sendKeys failed for "${target}":`, err)
      throw err
    }
  }

  async listPanes(sessionName: string): Promise<TmuxPaneInfo[]> {
    const name = this.sanitizeName(sessionName)
    try {
      const output = await this.exec([
        'list-panes',
        '-t',
        name,
        '-F',
        '#{pane_index}:#{pane_title}:#{pane_active}:#{pane_pid}'
      ])
      if (!output) return []
      return output.split('\n').map((line) => {
        const [index, title, active, pid] = line.split(':')
        return {
          index: parseInt(index, 10) || 0,
          title: title || '',
          active: active === '1',
          pid: parseInt(pid, 10) || 0
        }
      })
    } catch {
      return []
    }
  }

  async selectPane(sessionName: string, paneIndex: number): Promise<void> {
    const name = this.sanitizeName(sessionName)
    try {
      await this.exec(['select-pane', '-t', `${name}.${paneIndex}`])
    } catch (err) {
      console.error(`[TmuxManager] selectPane failed for "${name}.${paneIndex}":`, err)
      throw err
    }
  }

  async setLayout(
    sessionName: string,
    layout: 'even-horizontal' | 'even-vertical' | 'main-horizontal' | 'main-vertical' | 'tiled'
  ): Promise<void> {
    const name = this.sanitizeName(sessionName)
    try {
      await this.exec(['select-layout', '-t', name, layout])
    } catch (err) {
      console.error(`[TmuxManager] setLayout failed for "${name}" layout "${layout}":`, err)
      throw err
    }
  }

  async resizePane(
    sessionName: string,
    direction: 'U' | 'D' | 'L' | 'R',
    amount: number
  ): Promise<void> {
    const name = this.sanitizeName(sessionName)
    try {
      await this.exec(['resize-pane', '-t', name, `-${direction}`, String(amount)])
    } catch (err) {
      console.error(`[TmuxManager] resizePane failed for "${name}":`, err)
      throw err
    }
  }

  async killPane(sessionName: string, paneIndex: number): Promise<void> {
    const name = this.sanitizeName(sessionName)
    try {
      await this.exec(['kill-pane', '-t', `${name}.${paneIndex}`])
    } catch (err) {
      console.error(`[TmuxManager] killPane failed for "${name}.${paneIndex}":`, err)
      throw err
    }
  }

  async newWindow(
    sessionName: string,
    windowName: string,
    cwd: string,
    command?: string
  ): Promise<void> {
    const name = this.sanitizeName(sessionName)
    try {
      const args = ['new-window', '-t', name, '-n', windowName, '-c', cwd]
      if (command) {
        args.push(command)
      }
      await this.exec(args)
    } catch (err) {
      console.error(`[TmuxManager] newWindow failed for "${name}":`, err)
      throw err
    }
  }

  async cleanupAll(): Promise<void> {
    try {
      const sessions = await this.listSessions()
      const codroxSessions = sessions.filter((s) => s.name.startsWith('codrox-'))
      await Promise.all(codroxSessions.map((s) => this.killSession(s.name)))
    } catch (err) {
      console.error('[TmuxManager] cleanupAll failed:', err)
    }
  }

  getSessionName(worktreePath: string): string {
    const base = basename(worktreePath)
    return 'codrox-' + this.sanitizeName(base)
  }

  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-]/g, '-')
  }
}

export const tmuxManager = new TmuxManager()
