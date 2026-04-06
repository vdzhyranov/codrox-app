import { useRef, useEffect, useCallback, useState } from 'react'
import { useTmuxPTY } from '@renderer/hooks/useTmuxPTY'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Panel {
  id: string
  type: 'claude' | 'terminal'
  title: string
  widthPercent: number
  collapsed: boolean
  sessionName: string
}

// ── PanelTerminal ──────────────────────────────────────────────────────────────

interface PanelTerminalProps {
  sessionName: string
  worktreePath: string
  type: 'claude' | 'terminal'
}

function PanelTerminal({ sessionName, worktreePath, type }: PanelTerminalProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const didSendCommand = useRef(false)

  useTmuxPTY({ sessionName, worktreePath, containerRef })

  // For claude panels, send the `claude` command once after session creation
  useEffect(() => {
    if (type !== 'claude' || didSendCommand.current) return

    // Delay to let tmux session initialize
    const t = setTimeout(async () => {
      if (didSendCommand.current) return
      try {
        await window.api.invoke('tmux:sendKeys', { name: sessionName, keys: 'claude' })
        didSendCommand.current = true
      } catch {
        // session may not be ready yet — ignore, user can type manually
      }
    }, 800)

    return () => clearTimeout(t)
  }, [sessionName, type])

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}
    />
  )
}

// ── ResizeHandle ───────────────────────────────────────────────────────────────

interface ResizeHandleProps {
  onResizeStart: (e: React.MouseEvent) => void
}

function ResizeHandle({ onResizeStart }: ResizeHandleProps): JSX.Element {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseDown={onResizeStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 4,
        flexShrink: 0,
        background: hovered ? 'var(--accent)' : 'var(--border)',
        cursor: 'col-resize',
        transition: 'background .15s',
        zIndex: 10,
      }}
    />
  )
}

// ── WorkspaceView ──────────────────────────────────────────────────────────────

interface WorkspaceViewProps {
  worktreePath: string
}

export function WorkspaceView({ worktreePath }: WorkspaceViewProps): JSX.Element {
  const worktreeBase = (worktreePath.split('/').pop() ?? 'workspace').replace(/[^a-zA-Z0-9-]/g, '-')

  const makeSessionName = useCallback(
    (panelId: string) => `codrox-${worktreeBase}-${panelId}`,
    [worktreeBase]
  )

  const [panels, setPanels] = useState<Panel[]>(() => [
    {
      id: 'claude-main',
      type: 'claude',
      title: 'Claude',
      widthPercent: 75,
      collapsed: false,
      sessionName: `codrox-${worktreeBase}-claude-main`,
    },
    {
      id: 'terminal-main',
      type: 'terminal',
      title: 'Terminal',
      widthPercent: 25,
      collapsed: false,
      sessionName: `codrox-${worktreeBase}-terminal-main`,
    },
  ])

  const containerRef = useRef<HTMLDivElement>(null)
  const draggingPanel = useRef<string | null>(null)
  const dragOverPanel = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // ── Resize logic ────────────────────────────────────────────────────────────

  const handleResizeStart = useCallback(
    (leftPanelId: string, rightPanelId: string) =>
      (e: React.MouseEvent): void => {
        e.preventDefault()
        const startX = e.clientX
        const container = containerRef.current
        if (!container) return

        const containerWidth = container.getBoundingClientRect().width

        const onMouseMove = (me: MouseEvent): void => {
          const delta = me.clientX - startX
          const deltaPercent = (delta / containerWidth) * 100

          setPanels((prev) => {
            const leftIdx = prev.findIndex((p) => p.id === leftPanelId)
            const rightIdx = prev.findIndex((p) => p.id === rightPanelId)
            if (leftIdx === -1 || rightIdx === -1) return prev

            const left = prev[leftIdx]
            const right = prev[rightIdx]
            const combined = left.widthPercent + right.widthPercent
            const newLeft = Math.max(5, Math.min(combined - 5, left.widthPercent + deltaPercent))
            const newRight = combined - newLeft

            const next = [...prev]
            next[leftIdx] = { ...left, widthPercent: newLeft }
            next[rightIdx] = { ...right, widthPercent: newRight }
            return next
          })
        }

        const onMouseUp = (): void => {
          document.removeEventListener('mousemove', onMouseMove)
          document.removeEventListener('mouseup', onMouseUp)
        }

        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
      },
    []
  )

  // ── Collapse toggle ──────────────────────────────────────────────────────────

  const toggleCollapse = useCallback((id: string): void => {
    setPanels((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      if (idx === -1) return prev

      const panel = prev[idx]
      const willCollapse = !panel.collapsed

      if (willCollapse) {
        // Give the collapsed panel's width back to neighbours
        const otherVisible = prev.filter((p, i) => i !== idx && !p.collapsed)
        if (otherVisible.length === 0) return prev
        const share = panel.widthPercent / otherVisible.length
        return prev.map((p, i) => {
          if (i === idx) return { ...p, collapsed: true, widthPercent: 0 }
          if (!p.collapsed) return { ...p, widthPercent: p.widthPercent + share }
          return p
        })
      } else {
        // Restore collapsed panel to a default width, taking from neighbours
        const restorePercent = 25
        const visible = prev.filter((p, i) => i !== idx && !p.collapsed)
        if (visible.length === 0) return prev
        const shrinkPer = restorePercent / visible.length
        return prev.map((p, i) => {
          if (i === idx) return { ...p, collapsed: false, widthPercent: restorePercent }
          if (!p.collapsed) return { ...p, widthPercent: Math.max(5, p.widthPercent - shrinkPer) }
          return p
        })
      }
    })
  }, [])

  // ── Add panel ────────────────────────────────────────────────────────────────

  const addPanel = useCallback(
    (type: 'claude' | 'terminal'): void => {
      const id = `${type}-${Date.now()}`
      const sessionName = makeSessionName(id)
      const newPercent = 25

      setPanels((prev) => {
        // Shrink all visible panels proportionally to free up newPercent
        const visible = prev.filter((p) => !p.collapsed)
        const shrinkFactor = (100 - newPercent) / 100
        const next = prev.map((p) => {
          if (p.collapsed) return p
          return { ...p, widthPercent: p.widthPercent * shrinkFactor }
        })
        return [
          ...next,
          {
            id,
            type,
            title: type === 'claude' ? 'Claude' : 'Terminal',
            widthPercent: newPercent,
            collapsed: false,
            sessionName,
          },
        ]
      })
      void visible
    },
    [makeSessionName]
  )

  // ── Drag reorder ─────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((id: string) => (): void => {
    draggingPanel.current = id
  }, [])

  const handleDragOver = useCallback(
    (id: string) =>
      (e: React.DragEvent): void => {
        e.preventDefault()
        if (dragOverPanel.current !== id) {
          dragOverPanel.current = id
          setDragOverId(id)
        }
      },
    []
  )

  const handleDrop = useCallback((targetId: string) => (): void => {
    const fromId = draggingPanel.current
    if (!fromId || fromId === targetId) {
      draggingPanel.current = null
      dragOverPanel.current = null
      setDragOverId(null)
      return
    }

    setPanels((prev) => {
      const fromIdx = prev.findIndex((p) => p.id === fromId)
      const toIdx = prev.findIndex((p) => p.id === targetId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...prev]
      const [removed] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, removed)
      return next
    })

    draggingPanel.current = null
    dragOverPanel.current = null
    setDragOverId(null)
  }, [])

  const handleDragEnd = useCallback((): void => {
    draggingPanel.current = null
    dragOverPanel.current = null
    setDragOverId(null)
  }, [])

  // ── Visible panels ────────────────────────────────────────────────────────────

  const visiblePanelCount = panels.filter((p) => !p.collapsed).length

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Panel row */}
      <div
        ref={containerRef}
        style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}
      >
        {panels.map((panel, idx) => {
          const isCollapsed = panel.collapsed
          const panelWidth = isCollapsed ? 32 : `${panel.widthPercent}%`
          const isLastVisible = idx === panels.length - 1
          const nextPanel = panels[idx + 1]

          const borderLeft =
            panel.type === 'claude'
              ? '3px solid var(--accent)'
              : '3px solid var(--green)'

          return (
            <div
              key={panel.id}
              style={{ display: 'flex', flexDirection: 'row', width: isCollapsed ? 32 : `${panel.widthPercent}%`, minWidth: isCollapsed ? 32 : undefined, flexShrink: 0 }}
            >
              {/* Drop indicator */}
              {dragOverId === panel.id && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: 'var(--accent)',
                    zIndex: 20,
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Panel */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  borderLeft,
                  position: 'relative',
                }}
                onDragOver={handleDragOver(panel.id)}
                onDrop={() => handleDrop(panel.id)()}
              >
                {/* Panel header */}
                <div
                  draggable
                  onDragStart={handleDragStart(panel.id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    height: 24,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    padding: isCollapsed ? 0 : '0 6px',
                    background: 'var(--surface)',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'grab',
                    userSelect: 'none',
                    overflow: 'hidden',
                  }}
                >
                  {isCollapsed ? (
                    /* Rotated title when collapsed */
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        width: '100%',
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => toggleCollapse(panel.id)}
                        title="Expand panel"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text3)',
                          cursor: 'pointer',
                          fontSize: 9,
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
                        ▸
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: 'var(--mono)',
                          fontWeight: 600,
                          color: panel.type === 'claude' ? 'var(--accent2)' : 'var(--green)',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flexShrink: 1,
                        }}
                      >
                        {panel.title}
                      </span>
                      <button
                        onClick={() => toggleCollapse(panel.id)}
                        title="Collapse panel"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text3)',
                          cursor: 'pointer',
                          fontSize: 10,
                          padding: '0 2px',
                          lineHeight: 1,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
                      >
                        ▾
                      </button>
                    </>
                  )}
                </div>

                {/* Terminal content — hidden when collapsed */}
                {!isCollapsed && (
                  <PanelTerminal
                    sessionName={panel.sessionName}
                    worktreePath={worktreePath}
                    type={panel.type}
                  />
                )}
              </div>

              {/* Resize handle between panels */}
              {!isLastVisible && nextPanel && (
                <ResizeHandle
                  onResizeStart={handleResizeStart(panel.id, nextPanel.id)}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Footer bar */}
      <div
        style={{
          height: 28,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          gap: 6,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
        }}
      >
        {/* + Terminal */}
        <FooterButton type="terminal" onClick={() => addPanel('terminal')}>
          + Terminal
        </FooterButton>

        {/* + Claude */}
        <FooterButton type="claude" onClick={() => addPanel('claude')}>
          + Claude
        </FooterButton>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Panel count */}
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--mono)',
            color: 'var(--text3)',
            flexShrink: 0,
          }}
        >
          {visiblePanelCount} panel{visiblePanelCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

// ── FooterButton ───────────────────────────────────────────────────────────────

interface FooterButtonProps {
  type: 'claude' | 'terminal'
  onClick: () => void
  children: React.ReactNode
}

function FooterButton({ type, onClick, children }: FooterButtonProps): JSX.Element {
  const isAccent = type === 'claude'

  return (
    <button
      onClick={onClick}
      style={{
        height: 20,
        padding: '0 8px',
        borderRadius: 3,
        fontSize: 10,
        fontFamily: 'var(--mono)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        transition: 'background .1s, border-color .1s, color .1s',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        background: isAccent ? 'var(--accent-dim)' : 'var(--green-dim)',
        color: isAccent ? 'var(--accent2)' : 'var(--green)',
        border: isAccent ? '1px solid var(--accent)' : '1px solid var(--green)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isAccent ? 'var(--accent)' : 'var(--green)'
        e.currentTarget.style.color = isAccent ? '#fff' : '#000'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isAccent ? 'var(--accent-dim)' : 'var(--green-dim)'
        e.currentTarget.style.color = isAccent ? 'var(--accent2)' : 'var(--green)'
      }}
    >
      {children}
    </button>
  )
}
