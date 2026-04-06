import { useEffect, useRef, useState, useCallback } from 'react'
import { Sidebar } from '@renderer/layout/Sidebar'
import { MainContent } from '@renderer/layout/MainContent'
import { RightPanel } from '@renderer/layout/RightPanel'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import type { SessionData } from '@shared/types'

// ── ResizeHandle ────────────────────────────────────────────────────────────

interface ResizeHandleProps {
  onResize: (delta: number) => void
}

function ResizeHandle({ onResize }: ResizeHandleProps): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const dragging = useRef(false)
  const lastX = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true
      lastX.current = e.clientX
      e.preventDefault()

      const onMouseMove = (ev: MouseEvent): void => {
        if (!dragging.current) return
        const delta = ev.clientX - lastX.current
        lastX.current = ev.clientX
        onResize(delta)
      }

      const onMouseUp = (): void => {
        dragging.current = false
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [onResize],
  )

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 4,
        height: '100%',
        flexShrink: 0,
        cursor: 'col-resize',
        background: hovered ? 'var(--accent)' : 'transparent',
        transition: 'background .15s',
        zIndex: 10,
      }}
    />
  )
}

// ── TitleBar ────────────────────────────────────────────────────────────────

function TitleBar(): JSX.Element {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null

  return (
    <div
      style={{
        height: 40,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px 0 78px',
        gap: 16,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        WebkitAppRegion: 'drag' as React.CSSProperties['WebkitAppRegion'],
      } as React.CSSProperties}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ color: 'var(--accent)', fontSize: 16, lineHeight: 1 }}>◈</span>
        <span
          style={{
            fontFamily: 'var(--sans)',
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.05em',
            color: 'var(--text)',
          }}
        >
          COD<em style={{ color: 'var(--accent2)', fontStyle: 'normal' }}>ROX</em>
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }} />

      {/* Active workspace name — right-aligned, non-interactive */}
      {activeWorkspace && (
        <span
          style={{
            fontSize: 10,
            color: 'var(--text3)',
            letterSpacing: '0.06em',
            fontFamily: 'var(--mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 200,
          }}
        >
          {activeWorkspace.name}
        </span>
      )}
    </div>
  )
}

// ── App ─────────────────────────────────────────────────────────────────────

// Percentages for layout — sidebar and right panel as % of window width
const SIDEBAR_DEFAULT_PCT = 16  // ~220px on 1400px window
const SIDEBAR_MIN_PCT = 10
const SIDEBAR_MAX_PCT = 30
const RIGHT_DEFAULT_PCT = 20    // ~280px on 1400px window
const RIGHT_MIN_PCT = 12
const RIGHT_MAX_PCT = 35

function App(): JSX.Element {
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const setActiveWorktree = useWorkspaceStore((s) => s.setActiveWorktree)
  const loadWorktrees = useWorkspaceStore((s) => s.loadWorktrees)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const activeWorktreeId = useWorkspaceStore((s) => s.activeWorktreeId)
  const modeByWorktree = useWorkspaceStore((s) => s.modeByWorktree)

  const [sidebarPct, setSidebarPct] = useState(SIDEBAR_DEFAULT_PCT)
  const [rightPct, setRightPct] = useState(RIGHT_DEFAULT_PCT)
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // On mount: load workspaces then restore session
  useEffect(() => {
    const init = async (): Promise<void> => {
      await loadWorkspaces()
      try {
        const session = await window.api.invoke('session:load', undefined) as SessionData | null
        if (session?.activeWorkspaceId) {
          setActiveWorkspace(session.activeWorkspaceId)
          if (session.activeWorktreeId) {
            setActiveWorktree(session.activeWorktreeId)
          }
          // Load worktrees for the restored workspace
          const ws = useWorkspaceStore.getState().workspaces.find(
            (w) => w.id === session.activeWorkspaceId
          )
          if (ws) {
            await loadWorktrees(ws.id, ws.path).catch(() => {})
          }
        }
      } catch {
        // ignore session restore errors
      }
    }
    init()
  }, [])

  // Debounced session save on state changes
  useEffect(() => {
    if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current)
    sessionSaveTimer.current = setTimeout(() => {
      const sessionData: SessionData = {
        activeWorkspaceId,
        activeWorktreeId,
        modeByWorktree: modeByWorktree as Record<string, string>,
      }
      window.api.invoke('session:save', sessionData).catch(() => {})
    }, 500)
    return () => {
      if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current)
    }
  }, [activeWorkspaceId, activeWorktreeId, modeByWorktree])

  const handleSidebarResize = useCallback((delta: number) => {
    const width = containerRef.current?.getBoundingClientRect().width ?? 1400
    const deltaPct = (delta / width) * 100
    setSidebarPct((p) => Math.min(SIDEBAR_MAX_PCT, Math.max(SIDEBAR_MIN_PCT, p + deltaPct)))
  }, [])

  const handleRightResize = useCallback((delta: number) => {
    const width = containerRef.current?.getBoundingClientRect().width ?? 1400
    const deltaPct = (delta / width) * 100
    setRightPct((p) => Math.min(RIGHT_MAX_PCT, Math.max(RIGHT_MIN_PCT, p - deltaPct)))
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'var(--mono)',
      }}
    >
      <TitleBar />
      <div ref={containerRef} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar: activity bar (48px) + content panel (percentage) */}
        <div
          style={{
            width: `calc(${sidebarPct}% + 48px)`,
            flexShrink: 0,
            display: 'flex',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <Sidebar />
        </div>

        {/* Left resize handle */}
        <ResizeHandle onResize={handleSidebarResize} />

        {/* Main content — fills remaining space */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minWidth: 0 }}>
          <MainContent />
        </div>

        {/* Right resize handle */}
        <ResizeHandle onResize={handleRightResize} />

        {/* Right panel */}
        <div
          style={{
            width: `${rightPct}%`,
            flexShrink: 0,
            height: '100%',
            borderLeft: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          <RightPanel />
        </div>
      </div>
    </div>
  )
}

export default App
