import { useEffect, useRef, useState, useCallback } from 'react'
import { Sidebar } from '@renderer/layout/Sidebar'
import { MainContent } from '@renderer/layout/MainContent'
import { RightPanel } from '@renderer/layout/RightPanel'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'

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
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)

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
      {/* Logo — left-aligned, fixed width so pills can't overlap */}
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

      {/* Workspace pills — centered via flex-grow spacer */}
      <div style={{ flex: 1, minWidth: 0 }} />
      <div
        style={{
          display: 'flex',
          gap: 6,
          WebkitAppRegion: 'no-drag',
          flexShrink: 0,
        } as React.CSSProperties}
      >
        {activeWorkspace && (
          <span
            style={{
              fontSize: 10,
              padding: '3px 10px',
              borderRadius: 20,
              border: '1px solid rgba(124,106,247,.3)',
              background: 'var(--accent-dim)',
              color: 'var(--accent2)',
              cursor: 'default',
            }}
          >
            {activeWorkspace.name}
          </span>
        )}
        {workspaces
          .filter((w) => w.id !== activeWorkspaceId)
          .slice(0, 3)
          .map((w) => (
            <span
              key={w.id}
              onClick={() => setActiveWorkspace(w.id)}
              style={{
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 20,
                border: '1px solid var(--border)',
                color: 'var(--text3)',
                cursor: 'pointer',
                transition: 'all .15s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.color = 'var(--text2)'
                el.style.borderColor = 'var(--border2)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.color = 'var(--text3)'
                el.style.borderColor = 'var(--border)'
              }}
            >
              {w.name}
            </span>
          ))}
      </div>
    </div>
  )
}

// ── App ─────────────────────────────────────────────────────────────────────

const SIDEBAR_MIN = 160
const SIDEBAR_DEFAULT = 220
const RIGHT_MIN = 200
const RIGHT_DEFAULT = 280

function App(): JSX.Element {
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces)

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT)

  useEffect(() => {
    loadWorkspaces()
  }, [])

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(SIDEBAR_MIN, w + delta))
  }, [])

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((w) => Math.max(RIGHT_MIN, w - delta))
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
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar: activity bar (48px fixed) + content panel (sidebarWidth) */}
        <div
          style={{
            width: sidebarWidth + 48,
            minWidth: sidebarWidth + 48,
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

        {/* Main content */}
        <MainContent />

        {/* Right resize handle */}
        <ResizeHandle onResize={handleRightResize} />

        {/* Right panel */}
        <div
          style={{
            width: rightWidth,
            minWidth: rightWidth,
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
