import { useEffect, useRef, useState, useCallback } from 'react'
import { ActivityBar, SidebarContent } from '@renderer/layout/Sidebar'
import { MainContent } from '@renderer/layout/MainContent'
import { RightPanel } from '@renderer/layout/RightPanel'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { usePTYPrewarm } from '@renderer/hooks/usePTYPrewarm'
import type { SessionData } from '@shared/types'
import logoImg from '@renderer/assets/logo.png'

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
        padding: '0 16px 0 90px',
        gap: 16,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        WebkitAppRegion: 'drag' as React.CSSProperties['WebkitAppRegion'],
      } as React.CSSProperties}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <img src={logoImg} alt="Codrox" style={{ height: 18 }} draggable={false} />
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

// Layout uses 3 columns that always sum to 100% (plus 48px activity bar)
// sidebar% + main% + right% = 100
const SIDEBAR_DEFAULT = 18
const SIDEBAR_MIN = 8
const RIGHT_DEFAULT = 20
const RIGHT_MIN = 10
const MAIN_MIN = 30

function App(): JSX.Element {
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const setActiveWorktree = useWorkspaceStore((s) => s.setActiveWorktree)
  const loadWorktrees = useWorkspaceStore((s) => s.loadWorktrees)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const activeWorktreeId = useWorkspaceStore((s) => s.activeWorktreeId)
  const modeByWorktree = useWorkspaceStore((s) => s.modeByWorktree)

  usePTYPrewarm()

  const [sidebarPct, setSidebarPct] = useState(SIDEBAR_DEFAULT)
  const [rightPct, setRightPct] = useState(RIGHT_DEFAULT)
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load settings (theme + zoom) as early as possible
  useEffect(() => {
    useSettingsStore.getState().load()
  }, [])

  // Listen for zoom changes from main process (Menu shortcuts)
  useEffect(() => {
    const unsub = window.api.on('settings:zoomChanged', (...args: unknown[]) => {
      const data = args[0] as { level: number }
      useSettingsStore.getState().syncZoomFromMain(data.level)
    })
    return unsub
  }, [])

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
