import { useEffect, useRef, useState, useCallback } from 'react'
import { ActivityBar, SidebarContent } from '@renderer/layout/Sidebar'
import { MainContent } from '@renderer/layout/MainContent'
import { RightPanel } from '@renderer/layout/RightPanel'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
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

      // Add a full-screen overlay to prevent webviews/iframes from stealing mouse events
      const overlay = document.createElement('div')
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;cursor:col-resize;'
      document.body.appendChild(overlay)

      const onMouseMove = (ev: MouseEvent): void => {
        if (!dragging.current) return
        const delta = ev.clientX - lastX.current
        lastX.current = ev.clientX
        onResize(delta)
      }

      const onMouseUp = (): void => {
        dragging.current = false
        overlay.remove()
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
        width: 0,
        height: '100%',
        flexShrink: 0,
        cursor: 'col-resize',
        position: 'relative',
        zIndex: 20,
      }}
    >
      {/* Invisible wider hit area + visible indicator on hover */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: -3,
          width: 6,
          background: hovered ? 'var(--accent)' : 'transparent',
          transition: 'background .15s',
          cursor: 'col-resize',
        }}
      />
    </div>
  )
}

// ── Update Banner ──────────────────────────────────────────────────────────

type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'error'; message: string }

function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    const unsub = window.api.on('updater:status', (data: unknown) => {
      setStatus(data as UpdateStatus)
    })
    return unsub
  }, [])

  return status
}

function UpdateBanner({ status }: { status: UpdateStatus }): JSX.Element | null {
  const [dismissed, setDismissed] = useState(false)
  const [hovered, setHovered] = useState(false)

  const [copied, setCopied] = useState(false)

  // Reset dismissed when a new version is detected
  useEffect(() => {
    if (status.state === 'available') {
      setDismissed(false)
      setCopied(false)
    }
  }, [status.state])

  if (dismissed) return null
  if (status.state === 'idle' || status.state === 'checking' || status.state === 'not-available') return null

  const updateCmd = 'npm i -g github:vdzhyranov/codrox-app'

  const handleCopy = (): void => {
    window.api.clipboardWriteText(updateCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const color = status.state === 'error' ? 'var(--red)' : 'var(--accent)'
  const message =
    status.state === 'available'
      ? `Update v${status.version} available`
      : `Update check failed: ${(status as { message: string }).message}`

  return (
    <div
      style={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        borderBottom: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
        flexShrink: 0,
        fontSize: 11,
        color: 'var(--text2)',
      }}
    >
      <span>{message}</span>
      {status.state === 'available' && (
        <button
          onClick={handleCopy}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            background: hovered ? color : 'transparent',
            border: `1px solid ${color}`,
            borderRadius: 4,
            color: hovered ? '#fff' : color,
            fontSize: 10,
            padding: '1px 8px',
            cursor: 'pointer',
            fontFamily: 'var(--mono)',
            transition: 'all .12s',
          }}
        >
          {copied ? 'Copied!' : 'Copy update cmd'}
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text3)',
          fontSize: 12,
          lineHeight: 1,
          padding: '0 2px',
        }}
      >
        x
      </button>
    </div>
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

      {/* Version badge */}
      <span
        style={{
          fontSize: 9,
          color: 'var(--text3)',
          fontFamily: 'var(--mono)',
          opacity: 0.6,
          flexShrink: 0,
        }}
      >
        v{__APP_VERSION__}
      </span>
    </div>
  )
}

// ── App ─────────────────────────────────────────────────────────────────────

// Layout uses 3 columns that always sum to 100% (plus 48px activity bar)
// sidebar% + main% + right% = 100
const SIDEBAR_DEFAULT = 18
const SIDEBAR_MIN = 8
const RIGHT_DEFAULT = 20
const RIGHT_MIN = 10
const MAIN_MIN = 30

function App(): JSX.Element {
  const updateStatus = useUpdateStatus()
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const setActiveWorktree = useWorkspaceStore((s) => s.setActiveWorktree)
  const loadWorktrees = useWorkspaceStore((s) => s.loadWorktrees)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const activeWorktreeId = useWorkspaceStore((s) => s.activeWorktreeId)
  const modeByWorktree = useWorkspaceStore((s) => s.modeByWorktree)

  const [sidebarPct, setSidebarPct] = useState(SIDEBAR_DEFAULT)
  const [rightPct, setRightPct] = useState(RIGHT_DEFAULT)
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

  // Cmd+W closes active file tab instead of the app
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        const { activeTab, closeFile } = useFileTreeStore.getState()
        if (activeTab !== 'work') {
          e.preventDefault()
          closeFile(activeTab)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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

  // Sidebar resize: dragging left handle changes sidebar width, main absorbs the difference
  // Subtract 48px activity bar from total width before computing percentages
  const handleSidebarResize = useCallback((delta: number) => {
    const totalWidth = (containerRef.current?.getBoundingClientRect().width ?? 1400) - 48
    const dPct = (delta / totalWidth) * 100
    setSidebarPct((prev) => {
      const next = prev + dPct
      // Clamp: sidebar min, and main must stay >= MAIN_MIN
      const remaining = 100 - next - rightPct
      if (next < SIDEBAR_MIN) return SIDEBAR_MIN
      if (remaining < MAIN_MIN) return 100 - MAIN_MIN - rightPct
      return next
    })
  }, [rightPct])

  // Right resize: dragging right handle changes right width, main absorbs the difference
  // Subtract 48px activity bar from total width before computing percentages
  const handleRightResize = useCallback((delta: number) => {
    const totalWidth = (containerRef.current?.getBoundingClientRect().width ?? 1400) - 48
    const dPct = (delta / totalWidth) * 100
    setRightPct((prev) => {
      const next = prev - dPct // negative delta = growing right panel
      const remaining = 100 - sidebarPct - next
      if (next < RIGHT_MIN) return RIGHT_MIN
      if (remaining < MAIN_MIN) return 100 - MAIN_MIN - sidebarPct
      return next
    })
  }, [sidebarPct])

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
      <UpdateBanner status={updateStatus} />
      <div ref={containerRef} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Column 1: Activity bar — fixed 48px, outside the percentage system */}
        <div style={{ width: 48, minWidth: 48, flexShrink: 0, height: '100%' }}>
          <ActivityBar />
        </div>

        {/* Column 2: Workspace list — percentage based */}
        <div
          style={{
            width: `${sidebarPct}%`,
            flexShrink: 0,
            flexGrow: 0,
            height: '100%',
            overflow: 'hidden',
            borderRight: '1px solid var(--border)',
          }}
        >
          <SidebarContent />
        </div>

        {/* Left resize handle */}
        <ResizeHandle onResize={handleSidebarResize} />

        {/* Column 3: Main content */}
        <div
          style={{
            flex: 1,
            height: '100%',
            overflow: 'hidden',
            display: 'flex',
            minWidth: 0,
          }}
        >
          <MainContent />
        </div>

        {/* Right resize handle */}
        <ResizeHandle onResize={handleRightResize} />

        {/* Column 4: Files panel */}
        <div
          style={{
            width: `${rightPct}%`,
            flexShrink: 0,
            flexGrow: 0,
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
