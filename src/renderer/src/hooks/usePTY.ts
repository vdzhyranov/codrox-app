import { useEffect } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface UsePTYOptions {
  ptyId: string
  worktreeId: string
  cwd: string
  type: 'claude' | 'terminal'
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function usePTY({ ptyId, worktreeId, cwd, type, containerRef }: UsePTYOptions): void {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let rafId: number | null = null
    let cleanup: (() => void) | null = null

    // Wait for container to be in the DOM with actual pixel dimensions
    const init = (): void => {
      if (cancelled) return

      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        rafId = requestAnimationFrame(init)
        return
      }

      rafId = null

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
        theme: {
          background: '#18181b',
          foreground: '#f4f4f5',
          cursor: '#f4f4f5',
          selectionBackground: '#3f3f46',
          black: '#18181b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#f4f4f5'
        }
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(container)
      fitAddon.fit()

      // Create PTY in main process
      window.api.invoke('pty:create', {
        id: ptyId,
        worktreeId,
        cwd,
        type
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
          term.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
        }
      })

      // Handle resize
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
        window.api.invoke('pty:destroy', { id: ptyId })
      }
    }

    rafId = requestAnimationFrame(init)

    return () => {
      cancelled = true
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      cleanup?.()
    }
  }, [ptyId, worktreeId, cwd, type, containerRef])
}
