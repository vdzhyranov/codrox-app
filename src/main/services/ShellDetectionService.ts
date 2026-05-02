import { exec } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import * as path from 'path'

export interface ShellInfo {
  path: string
  name: string
}

export interface ClaudeResolution {
  bin: string
  path: string
}

class ShellDetectionService {
  private shellsCache: ShellInfo[] | null = null
  private resolutionCache = new Map<string, Promise<ClaudeResolution | null>>()

  detectShells(): ShellInfo[] {
    if (this.shellsCache) return this.shellsCache

    const found: ShellInfo[] = []
    const seen = new Set<string>()

    const add = (raw: string): void => {
      const normalized = raw.trim()
      if (!normalized || normalized.startsWith('#')) return
      if (seen.has(normalized)) return
      if (!existsSync(normalized)) return
      seen.add(normalized)
      found.push({ path: normalized, name: path.basename(normalized) })
    }

    try {
      for (const line of readFileSync('/etc/shells', 'utf-8').split('\n')) add(line)
    } catch { /* /etc/shells absent on some systems */ }

    if (process.env.SHELL) add(process.env.SHELL)

    for (const fallback of [
      '/bin/zsh', '/bin/bash', '/usr/bin/bash',
      '/opt/homebrew/bin/fish', '/usr/local/bin/fish',
    ]) add(fallback)

    this.shellsCache = found
    return found
  }

  resolveClaudeBin(preferredShell?: string): Promise<ClaudeResolution | null> {
    const shell = preferredShell || process.env.SHELL || '/bin/zsh'
    if (!this.resolutionCache.has(shell)) {
      this.resolutionCache.set(shell, this._resolve(shell))
    }
    return this.resolutionCache.get(shell)!
  }

  private _resolve(shell: string): Promise<ClaudeResolution | null> {
    return new Promise((resolve) => {
      const name = path.basename(shell)
      let cmd: string

      if (name === 'fish') {
        // fish uses list syntax for $PATH
        cmd = `'${shell}' -ilc 'printf "%s\\t%s" (which claude 2>/dev/null) (string join ":" $PATH)' 2>/dev/null`
      } else {
        // POSIX-compatible shells (zsh, bash, ksh, …)
        // -i: interactive → sources .zshrc/.bashrc (picks up nvm, volta, etc.)
        // -l: login      → sources .zprofile/.bash_profile
        cmd = `'${shell}' -ilc 'printf "%s\\t%s" "$(which claude 2>/dev/null)" "$PATH"' 2>/dev/null`
      }

      exec(cmd, { timeout: 10000 }, (_err, stdout) => {
        // Strip any ANSI escape codes that interactive shells may emit
        const cleaned = stdout.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim()
        const tab = cleaned.indexOf('\t')
        if (tab < 0) { resolve(null); return }
        const bin = cleaned.slice(0, tab).trim()
        const envPath = cleaned.slice(tab + 1).trim()
        if (bin && existsSync(bin)) {
          console.log('[ShellDetection] claude resolved:', bin, 'via', shell)
          resolve({ bin, path: envPath })
        } else {
          console.warn('[ShellDetection] claude not found via', shell)
          resolve(null)
        }
      })
    })
  }

  invalidateClaudeResolution(shell?: string): void {
    if (shell) this.resolutionCache.delete(shell)
    else this.resolutionCache.clear()
  }

  warm(preferredShell?: string): void {
    this.detectShells()
    this.resolveClaudeBin(preferredShell).catch(() => {})
  }
}

export const shellDetectionService = new ShellDetectionService()
