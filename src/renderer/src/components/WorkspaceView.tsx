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

interface BottomTerminal {
  sessionName: string
  collapsed: boolean
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

// ── HorizontalResizeHandle ─────────────────────────────────────────────────────

interface HorizontalResizeHandleProps {
  onResizeStart: (e: React.MouseEvent) => void
}

function HorizontalResizeHandle({ onResizeStart }: HorizontalResizeHandleProps): JSX.Element {
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

// ── VerticalResizeHandle ───────────────────────────────────────────────────────

interface VerticalResizeHandleProps {
  onResizeStart: (e: React.MouseEvent) => void
}

function VerticalResizeHandle({ onResizeStart }: VerticalResizeHandleProps): JSX.Element {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseDown={onResizeStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 4,
        flexShrink: 0,
        background: hovered ? 'var(--accent)' : 'var(--border)',
        cursor: 'row-resize',
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

  // Top panels (Claude + additional panels added via + buttons)
  const [topPanels, setTopPanels] = useState<Panel[]>(() => [
    {
      id: 'claude-main',
      type: 'claude',
      title: 'Claude',
      widthPercent: 100,
      collapsed: false,
      sessionName: `codrox-${worktreeBase}-claude-main`,
    },
  ])

  // Bottom terminal (always present, can collapse)
  const [bottomTerminal, setBottomTerminal] = useState<BottomTerminal>(() => ({
    sessionName: `codrox-${worktreeBase}-terminal-main`,
    collapsed: false,
  }))

  // Top/bottom split as percentage for the top section (default 75%)
  const [topBottomSplit, setTopBottomSplit] = useState(75)

  const outerRef = useRef<HTMLDivElement>(null)
  const topPanelsRef = useRef<HTMLDivElement>(null)

  // ── Top/Bottom resize logic ──────────────────────────────────────────────────

  const handleVerticalResizeStart = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault()
      const startY = e.clientY
      const container = outerRef.current
      if (!container) return

      const containerHeight = container.getBoundingClientRect().height

      const onMouseMove = (me: MouseEvent): void => {
        const delta = me.clientY - startY
        const deltaPercent = (delta / containerHeight) * 100
        setTopBottomSplit((prev) => Math.max(30, Math.min(85, prev + deltaPercent)))
      }

      const onMouseUp = (): void => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    },
    []
  )

  // ── Horizontal resize between top panels ─────────────────────────────────────

  const handleHorizontalResizeStart = useCallback(
    (leftPanelId: string, rightPanelId: string) =>
      (e: React.MouseEvent): void => {
        e.preventDefault()
        const startX = e.clientX
        const container = topPanelsRef.current
        if (!container) return

        const containerWidth = container.getBoundingClientRect().width

        const onMouseMove = (me: MouseEvent): void => {
          const delta = me.clientX - startX
          const deltaPercent = (delta / containerWidth) * 100

          setTopPanels((prev) => {
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
          document.body.style.cursor = ''
          document.body.style.userSelect = ''
        }

        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
      },
    []
  )

  // ── Collapse toggle for top panels ───────────────────────────────────────────

  const toggleTopPanelCollapse = useCallback((id: string): void => {
    setTopPanels((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      if (idx === -1) return prev

      const panel = prev[idx]
      const willCollapse = !panel.collapsed

      if (willCollapse) {
        const otherVisible = prev.filter((p, i) => i !== idx && !p.collapsed)
        if (otherVisible.length === 0) return prev
        const share = panel.widthPercent / otherVisible.length
        return prev.map((p, i) => {
          if (i === idx) return { ...p, collapsed: true, widthPercent: 0 }
          if (!p.collapsed) return { ...p, widthPercent: p.widthPercent + share }
          return p
        })
      } else {
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

  // ── Toggle bottom terminal collapse ──────────────────────────────────────────

  const toggleBottomCollapse = useCallback((): void => {
    setBottomTerminal((prev) => ({ ...prev, collapsed: !prev.collapsed }))
  }, [])

  // ── Add panel ────────────────────────────────────────────────────────────────

  const addPanel = useCallback(
    (type: 'claude' | 'terminal'): void => {
      const id = `${type}-${Date.now()}`
      const sessionName = makeSessionName(id)
      const newPercent = 25

      setTopPanels((prev) => {
        const visible = prev.filter((p) => !p.collapsed)
        const shrinkFactor = (100 - newPercent) / 100
        const next = prev.map((p) => {
          if (p.collapsed) return p
          return { ...p, widthPercent: p.widthPercent * shrinkFactor }
        })
        void visible
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
    },
    [makeSessionName]
  )

  // ── Drag reorder for top panels ───────────────────────────────────────────────

  const draggingPanel = useRef<string | null>(null)
  const dragOverPanel = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

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

    setTopPanels((prev) => {
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

  // ── Visible panel count ───────────────────────────────────────────────────────

  const visibleTopPanelCount = topPanels.filter((p) => !p.collapsed).length

  // ── Bottom section height ─────────────────────────────────────────────────────

  const bottomHeightStyle = bottomTerminal.collapsed
    ? 28
    : `${100 - topBottomSplit}%`

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={outerRef}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}
    >
      {/* Top section */}
      <div
        style={{
          flex: bottomTerminal.collapsed ? 1 : undefined,
          height: bottomTerminal.collapsed ? undefined : `${topBottomSplit}%`,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <div
          ref={topPanelsRef}
          style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minWidth: 0 }}
        >
          {topPanels.map((panel, idx) => {
            const isCollapsed = panel.collapsed
            const nextPanel = topPanels[idx + 1]
            const isLast = idx === topPanels.length - 1

            const borderLeft =
              panel.type === 'claude'
                ? '3px solid var(--accent)'
                : '3px solid var(--green)'

            return (
              <div
                key={panel.id}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  width: isCollapsed ? 32 : `${panel.widthPercent}%`,
                  minWidth: isCollapsed ? 32 : undefined,
                  flexShrink: 0,
                }}
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
                          onClick={() => toggleTopPanelCollapse(panel.id)}
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
                          onClick={() => toggleTopPanelCollapse(panel.id)}
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

                {/* Horizontal resize handle between top panels */}
                {!isLast && nextPanel && (
                  <HorizontalResizeHandle
                    onResizeStart={handleHorizontalResizeStart(panel.id, nextPanel.id)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Vertical drag handle between top and bottom */}
      {!bottomTerminal.collapsed && (
        <VerticalResizeHandle onResizeStart={handleVerticalResizeStart} />
      )}

      {/* Bottom terminal section */}
      <div
        style={{
          height: bottomHeightStyle,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: bottomTerminal.collapsed ? '1px solid var(--border)' : undefined,
        }}
      >
        {/* Bottom terminal header */}
        <div
          style={{
            height: 28,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            borderTop: '1px solid var(--border)',
            userSelect: 'none',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--mono)',
              fontWeight: 600,
              color: 'var(--green)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Terminal {bottomTerminal.collapsed ? '▸' : '▾'}
          </span>
          <button
            onClick={toggleBottomCollapse}
            title={bottomTerminal.collapsed ? 'Expand terminal' : 'Collapse terminal'}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text3)',
              cursor: 'pointer',
              fontSize: 10,
              padding: '0 2px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
          >
            {bottomTerminal.collapsed ? '▸' : '▾'}
          </button>
        </div>

        {/* Bottom terminal content */}
        {!bottomTerminal.collapsed && (
          <PanelTerminal
            sessionName={bottomTerminal.sessionName}
            worktreePath={worktreePath}
            type="terminal"
          />
        )}
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
        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* + Terminal */}
        <FooterButton type="terminal" onClick={() => addPanel('terminal')}>
          + Terminal
        </FooterButton>

        {/* + Claude */}
        <FooterButton type="claude" onClick={() => addPanel('claude')}>
          + Claude
        </FooterButton>

        {/* Panel count */}
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--mono)',
            color: 'var(--text3)',
            flexShrink: 0,
            marginLeft: 4,
          }}
        >
          {visibleTopPanelCount} panel{visibleTopPanelCount !== 1 ? 's' : ''}
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
