import { useEffect } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface UsePTYOptions {
  ptyId: string
  worktreeId: string
  workspaceId?: string
  cwd: string
  type: 'claude' | 'terminal'
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function usePTY({ ptyId, worktreeId, workspaceId, cwd, type, containerRef }: UsePTYOptions): void {
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
        allowProposedApi: true,
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
        theme: {
          background: '#18181b',
          foreground: '#f8f8fc',
          cursor: '#f8f8fc',
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
      const unicode11 = new Unicode11Addon()
      const webLinks = new WebLinksAddon((_event, uri) => {
        window.dispatchEvent(new CustomEvent('open-in-browser', { detail: { url: uri } }))
      })
      term.loadAddon(fitAddon)
      term.loadAddon(unicode11)
      term.loadAddon(webLinks)
      term.unicode.activeVersion = '11'

      // Register file path link provider (clickable paths like src/foo.ts:42)
      term.registerLinkProvider({
        provideLinks(lineNumber, callback) {
          const line = term.buffer.active.getLine(lineNumber - 1)
          if (!line) { callback(undefined); return }
          const text = line.translateToString()
          const links: Array<{ range: { start: { x: number; y: number }; end: { x: number; y: number } }; text: string; activate: () => void }> = []
          // Match file paths: ./foo, ../foo, src/foo.ts, /abs/path, with optional :line:col
          const pathRegex = /(?:^|\s)((?:\.{1,2}\/|\/|[a-zA-Z][\w.-]*\/)[^\s:]+(?::\d+(?::\d+)?)?)/g
          let match: RegExpExecArray | null
          while ((match = pathRegex.exec(text)) !== null) {
            const startX = match.index + (text[match.index] === ' ' || text[match.index] === '\t' ? 1 : 0)
            const pathText = match[1]
            links.push({
              range: {
                start: { x: startX + 1, y: lineNumber },
                end: { x: startX + pathText.length + 1, y: lineNumber },
              },
              text: pathText,
              activate() {
                // Open file path in the app's file viewer via the tab system
                const filePath = pathText.replace(/:\d+(:\d+)?$/, '')
                window.api.invoke('shell:openPath', { path: filePath })
              },
            })
          }
          callback(links.length > 0 ? links : undefined)
        },
      })

      term.open(container)
      fitAddon.fit()

      // Copy on select: auto-copy to clipboard when text is selected with mouse
      term.onSelectionChange(() => {
        const sel = term.getSelection()
        if (sel) window.api.clipboardWriteText(sel)
      })

      term.attachCustomKeyEventHandler((e) => {
        // Block Shift+Enter on both keydown and keypress to prevent xterm sending \r
        if (e.shiftKey && e.key === 'Enter') {
          if (e.type === 'keydown') {
            window.api.invoke('pty:write', { id: ptyId, data: '\x1b[13;2u' })
          }
          return false
        }
        if (e.type !== 'keydown') return true
        // Cmd+C: copy selection
        if (e.metaKey && e.key === 'c') {
          const sel = term.getSelection()
          if (sel) window.api.clipboardWriteText(sel)
          return false
        }
        return true
      })

      // Create PTY in main process
      window.api.invoke('pty:create', {
        id: ptyId,
        worktreeId,
        workspaceId,
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
  }, [ptyId, worktreeId, workspaceId, cwd, type, containerRef])
}
