import { useEffect } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface UseTmuxPTYOptions {
  sessionName: string
  worktreePath: string
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function useTmuxPTY({ sessionName, worktreePath, containerRef }: UseTmuxPTYOptions): void {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ptyId = `tmux-${sessionName}`
    let cancelled = false
    let rafId: number | null = null
    let cleanup: (() => void) | null = null

    // Wait for container to be in the DOM with actual pixel dimensions
    const init = async (): Promise<void> => {
      if (cancelled) return

      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        rafId = requestAnimationFrame(() => { void init() })
        return
      }

      rafId = null

      // Ensure the tmux session exists before attaching
      try {
        await window.api.invoke('tmux:createSession', { name: sessionName, cwd: worktreePath })
      } catch {
        // Session may already exist — that's fine, tmux returns error for existing sessions
      }

      if (cancelled) return

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
        theme: {
          background: '#0a0a0b',
          foreground: '#e4e4f0',
          cursor: '#e4e4f0',
          selectionBackground: '#2a2a32',
          black: '#0a0a0b',
          red: '#f87171',
          green: '#3ecf8e',
          yellow: '#f59e0b',
          blue: '#60a5fa',
          magenta: '#a78bfa',
          cyan: '#06b6d4',
          white: '#e4e4f0'
        }
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(container)
      fitAddon.fit()

      // Create PTY in main process — spawn tmux attach-session
      window.api.invoke('pty:create', {
        id: ptyId,
        worktreeId: sessionName,
        cwd: worktreePath,
        shell: 'tmux',
        args: ['attach-session', '-t', sessionName],
        type: 'terminal'
      })

      // Forward user input to PTY
      term.onData((data) => {
        window.api.invoke('pty:write', { id: ptyId, data })
      })

      // Receive PTY output
      const unsubOutput = window.api.on('pty:output', (payload: unknown) => {
        const { id, data } = payload as { id: string; data: string }
        if (id === ptyId) {
          term.write(data)
        }
      })

      // Handle PTY exit
      const unsubExit = window.api.on('pty:exit', (payload: unknown) => {
        const { id, exitCode } = payload as { id: string; exitCode: number }
        if (id === ptyId) {
          term.write(`\r\n\x1b[90m[tmux session detached (code ${exitCode})]\x1b[0m\r\n`)
        }
      })

      // Handle resize — tmux auto-adjusts its pane layout
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit()
          window.api.invoke('pty:resize', { id: ptyId, cols: term.cols, rows: term.rows })
        } catch {
          // ignore during layout transitions
        }
      })
      resizeObserver.observe(container)

      cleanup = (): void => {
        unsubOutput()
        unsubExit()
        resizeObserver.disconnect()
        term.dispose()
        // Destroy the PTY process (detaches from tmux), but do NOT kill the tmux session
        window.api.invoke('pty:destroy', { id: ptyId })
      }
    }

    rafId = requestAnimationFrame(() => { void init() })

    return () => {
      cancelled = true
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      cleanup?.()
    }
  }, [sessionName, worktreePath, containerRef])
}
