import { useEffect, useState } from 'react'

interface TmuxToolbarProps {
  sessionName: string
  worktreePath: string
}

const LAYOUTS = [
  { value: 'even-horizontal', label: 'Even H' },
  { value: 'even-vertical', label: 'Even V' },
  { value: 'main-horizontal', label: 'Main H' },
  { value: 'main-vertical', label: 'Main V' },
  { value: 'tiled', label: 'Tiled' },
] as const

type Layout = (typeof LAYOUTS)[number]['value']

export function TmuxToolbar({ sessionName, worktreePath }: TmuxToolbarProps): JSX.Element {
  const [paneCount, setPaneCount] = useState<number>(1)

  // Poll pane count
  useEffect(() => {
    let cancelled = false

    const refresh = async (): Promise<void> => {
      try {
        const panes = (await window.api.invoke('tmux:listPanes', { name: sessionName })) as Array<unknown>
        if (!cancelled) {
          setPaneCount(Array.isArray(panes) ? panes.length : 1)
        }
      } catch {
        // session may not exist yet
      }
    }

    void refresh()
    const interval = setInterval(() => { void refresh() }, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [sessionName])

  const splitH = async (): Promise<void> => {
    try {
      await window.api.invoke('tmux:splitH', { name: sessionName, cwd: worktreePath })
    } catch (err) {
      console.error('[TmuxToolbar] splitH failed:', err)
    }
  }

  const splitV = async (): Promise<void> => {
    try {
      await window.api.invoke('tmux:splitV', { name: sessionName, cwd: worktreePath })
    } catch (err) {
      console.error('[TmuxToolbar] splitV failed:', err)
    }
  }

  const openClaude = async (): Promise<void> => {
    try {
      await window.api.invoke('tmux:splitH', { name: sessionName, cwd: worktreePath, command: 'claude' })
    } catch (err) {
      console.error('[TmuxToolbar] openClaude failed:', err)
    }
  }

  const openTerminal = async (): Promise<void> => {
    try {
      await window.api.invoke('tmux:splitH', { name: sessionName, cwd: worktreePath })
    } catch (err) {
      console.error('[TmuxToolbar] openTerminal failed:', err)
    }
  }

  const applyLayout = async (layout: Layout): Promise<void> => {
    try {
      await window.api.invoke('tmux:setLayout', { name: sessionName, layout })
    } catch (err) {
      console.error('[TmuxToolbar] setLayout failed:', err)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 32,
        flexShrink: 0,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 8px',
        gap: 4,
      }}
    >
      {/* Split H */}
      <ToolbarButton onClick={() => { void splitH() }} title="Split horizontal">
        ⊞ Split H
      </ToolbarButton>

      {/* Split V */}
      <ToolbarButton onClick={() => { void splitV() }} title="Split vertical">
        ⊟ Split V
      </ToolbarButton>

      {/* Layout dropdown */}
      <select
        onChange={(e) => { void applyLayout(e.target.value as Layout) }}
        defaultValue=""
        title="Select layout"
        style={{
          height: 22,
          fontSize: 10,
          fontFamily: 'var(--mono)',
          background: 'var(--surface2)',
          color: 'var(--text2)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          padding: '0 4px',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <option value="" disabled>Layout</option>
        {LAYOUTS.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>

      {/* Separator */}
      <div
        style={{
          width: 1,
          height: 16,
          background: 'var(--border)',
          margin: '0 2px',
          flexShrink: 0,
        }}
      />

      {/* + Claude */}
      <ToolbarButton
        onClick={() => { void openClaude() }}
        title="Open Claude in new pane"
        accent
      >
        + Claude
      </ToolbarButton>

      {/* + Terminal */}
      <ToolbarButton
        onClick={() => { void openTerminal() }}
        title="Open terminal in new pane"
        green
      >
        + Terminal
      </ToolbarButton>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Pane count */}
      <span
        style={{
          fontSize: 10,
          fontFamily: 'var(--mono)',
          color: 'var(--text3)',
          flexShrink: 0,
        }}
      >
        Panes: {paneCount}
      </span>
    </div>
  )
}

// ── Shared button component ──────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void
  title?: string
  accent?: boolean
  green?: boolean
  children: React.ReactNode
}

function ToolbarButton({ onClick, title, accent, green, children }: ToolbarButtonProps): JSX.Element {
  const baseStyle: React.CSSProperties = {
    height: 22,
    padding: '0 7px',
    borderRadius: 3,
    fontSize: 10,
    fontFamily: 'var(--mono)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
    transition: 'background .1s, border-color .1s, color .1s',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  }

  if (accent) {
    return (
      <button
        onClick={onClick}
        title={title}
        style={{
          ...baseStyle,
          background: 'var(--accent-dim)',
          color: 'var(--accent2)',
          border: '1px solid var(--accent)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--accent)'
          e.currentTarget.style.color = '#fff'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--accent-dim)'
          e.currentTarget.style.color = 'var(--accent2)'
        }}
      >
        {children}
      </button>
    )
  }

  if (green) {
    return (
      <button
        onClick={onClick}
        title={title}
        style={{
          ...baseStyle,
          background: 'var(--green-dim)',
          color: 'var(--green)',
          border: '1px solid var(--green)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--green)'
          e.currentTarget.style.color = '#000'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--green-dim)'
          e.currentTarget.style.color = 'var(--green)'
        }}
      >
        {children}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        ...baseStyle,
        background: 'transparent',
        color: 'var(--text2)',
        border: '1px solid var(--border)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--text)'
        e.currentTarget.style.borderColor = 'var(--border2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text2)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {children}
    </button>
  )
}
