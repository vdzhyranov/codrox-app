import { useRef, useCallback, useState } from 'react'
import { usePTY } from '@renderer/hooks/usePTY'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { FileViewer } from '@renderer/components/FileViewer'
import { AgentOutputViewer } from '@renderer/components/AgentOutputViewer'
// ── Types ──────────────────────────────────────────────────────────────────────

interface PaneLeaf {
  type: 'leaf'
  id: string
  panelType: 'claude' | 'terminal'
  title: string
  sessionName: string
}

interface PaneSplit {
  type: 'split'
  id: string
  direction: 'horizontal' | 'vertical'
  ratio: number
  first: PaneNode
  second: PaneNode
}

type PaneNode = PaneLeaf | PaneSplit
type DropZone = 'left' | 'right' | 'top' | 'bottom' | 'center'

interface BottomTerminal {
  sessionName: string
  collapsed: boolean
}

// ── Tree Helpers ──────────────────────────────────────────────────────────────

let _idCounter = 0
function makeId(): string {
  return `pane-${Date.now()}-${++_idCounter}`
}

function removePane(root: PaneNode, id: string): PaneNode | null {
  if (root.type === 'leaf') {
    return root.id === id ? null : root
  }
  if (root.first.type === 'leaf' && root.first.id === id) return root.second
  if (root.second.type === 'leaf' && root.second.id === id) return root.first

  const newFirst = removePane(root.first, id)
  if (newFirst !== root.first) {
    return newFirst === null ? root.second : { ...root, first: newFirst }
  }
  const newSecond = removePane(root.second, id)
  if (newSecond !== root.second) {
    return newSecond === null ? root.first : { ...root, second: newSecond }
  }
  return root
}

function insertAtPane(
  root: PaneNode,
  targetId: string,
  newLeaf: PaneLeaf,
  zone: DropZone,
): PaneNode {
  if (root.type === 'leaf') {
    if (root.id !== targetId) return root

    const direction: 'horizontal' | 'vertical' =
      zone === 'left' || zone === 'right' ? 'horizontal' : 'vertical'

    const first = zone === 'right' || zone === 'bottom' ? root : newLeaf
    const second = zone === 'right' || zone === 'bottom' ? newLeaf : root

    return {
      type: 'split',
      id: makeId(),
      direction,
      ratio: 0.5,
      first,
      second,
    }
  }

  return {
    ...root,
    first: insertAtPane(root.first, targetId, newLeaf, zone),
    second: insertAtPane(root.second, targetId, newLeaf, zone),
  }
}

function updateRatio(root: PaneNode, splitId: string, ratio: number): PaneNode {
  if (root.type === 'leaf') return root
  if (root.id === splitId) return { ...root, ratio: Math.max(0.15, Math.min(0.85, ratio)) }
  return {
    ...root,
    first: updateRatio(root.first, splitId, ratio),
    second: updateRatio(root.second, splitId, ratio),
  }
}

function findFirstLeafId(node: PaneNode): string {
  if (node.type === 'leaf') return node.id
  return findFirstLeafId(node.first)
}

function countLeaves(node: PaneNode): number {
  if (node.type === 'leaf') return 1
  return countLeaves(node.first) + countLeaves(node.second)
}

function findLeafById(node: PaneNode, id: string): PaneLeaf | null {
  if (node.type === 'leaf') return node.id === id ? node : null
  return findLeafById(node.first, id) ?? findLeafById(node.second, id)
}

// ── PanelTerminal ──────────────────────────────────────────────────────────────

interface PanelTerminalProps {
  sessionName: string
  worktreePath: string
  type: 'claude' | 'terminal'
}

function PanelTerminal({ sessionName, worktreePath, type }: PanelTerminalProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  usePTY({ ptyId: sessionName, worktreeId: sessionName, cwd: worktreePath, type, containerRef })

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
        background: '#0a0a0b',
      }}
    />
  )
}

// ── SplitResizeHandle ─────────────────────────────────────────────────────────

function SplitResizeHandle({
  direction,
  onResizeStart,
}: {
  direction: 'horizontal' | 'vertical'
  onResizeStart: (e: React.MouseEvent) => void
}): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const isH = direction === 'horizontal'

  return (
    <div
      onMouseDown={onResizeStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        [isH ? 'width' : 'height']: 4,
        flexShrink: 0,
        background: hovered ? 'var(--accent)' : 'var(--border)',
        cursor: isH ? 'col-resize' : 'row-resize',
        transition: 'background .15s',
        zIndex: 10,
      }}
    />
  )
}

// ── DropZoneOverlay ──────────────────────────────────────────────────────────

function DropZoneOverlay({
  onDrop,
}: {
  onDrop: (zone: DropZone) => void
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [zone, setZone] = useState<DropZone>('center')

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return

    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    let z: DropZone = 'center'
    if (x < 0.22) z = 'left'
    else if (x > 0.78) z = 'right'
    else if (y < 0.22) z = 'top'
    else if (y > 0.78) z = 'bottom'
    setZone(z)
  }, [])

  const zoneStyle = (z: DropZone): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      background: 'rgba(124, 106, 247, 0.12)',
      border: '2px solid var(--accent)',
      borderRadius: 4,
      transition: 'all .1s',
      pointerEvents: 'none',
    }
    switch (z) {
      case 'left':
        return { ...base, left: 0, top: 0, bottom: 0, width: '50%' }
      case 'right':
        return { ...base, right: 0, top: 0, bottom: 0, width: '50%' }
      case 'top':
        return { ...base, left: 0, top: 0, right: 0, height: '50%' }
      case 'bottom':
        return { ...base, left: 0, bottom: 0, right: 0, height: '50%' }
      case 'center':
        return { ...base, left: '10%', top: '10%', right: '10%', bottom: '10%' }
    }
  }

  return (
    <div
      ref={ref}
      onDragOver={handleDragOver}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(zone)
      }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 15,
      }}
    >
      <div style={zoneStyle(zone)} />
    </div>
  )
}

// ── PaneRenderer (recursive) ──────────────────────────────────────────────────

interface PaneRendererProps {
  node: PaneNode
  worktreePath: string
  focusedId: string | null
  draggingId: string | null
  onFocus: (id: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDrop: (targetId: string, zone: DropZone) => void
  onRatioChange: (splitId: string, ratio: number) => void
  onClose: (id: string) => void
  canClose: boolean
}

function PaneRenderer(props: PaneRendererProps): JSX.Element {
  if (props.node.type === 'leaf') return <LeafPane {...props} node={props.node} />
  return <SplitPane {...props} node={props.node} />
}

// ── LeafPane ──

function LeafPane({
  node,
  worktreePath,
  focusedId,
  draggingId,
  onFocus,
  onDragStart,
  onDragEnd,
  onDrop,
  onClose,
  canClose,
}: Omit<PaneRendererProps, 'node'> & { node: PaneLeaf }): JSX.Element {
  const isFocused = focusedId === node.id
  const isDragging = draggingId === node.id
  const showDropZone = draggingId !== null && draggingId !== node.id

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        opacity: isDragging ? 0.4 : 1,
        minWidth: 0,
        minHeight: 0,
        background: 'var(--bg)',
      }}
      onMouseDown={() => onFocus(node.id)}
    >
      {isFocused && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: '1px solid var(--accent)',
            borderRadius: 1,
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
      )}

      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', node.id)
          onDragStart(node.id)
        }}
        onDragEnd={onDragEnd}
        style={{
          height: 28,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          background: isFocused ? 'var(--surface2)' : 'var(--surface)',
          borderBottom: isFocused
            ? '2px solid var(--accent)'
            : '1px solid var(--border)',
          cursor: 'grab',
          userSelect: 'none',
          overflow: 'hidden',
          zIndex: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--mono)',
            fontWeight: 600,
            color: node.panelType === 'claude' ? 'var(--accent2)' : 'var(--green)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.title}
        </span>
        {canClose && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose(node.id)
            }}
            title="Close panel"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text3)',
              cursor: 'pointer',
              fontSize: 14,
              padding: '0 2px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
          >
            ×
          </button>
        )}
      </div>

      <PanelTerminal
        sessionName={node.sessionName}
        worktreePath={worktreePath}
        type={node.panelType}
      />

      {showDropZone && (
        <DropZoneOverlay onDrop={(z) => onDrop(node.id, z)} />
      )}
    </div>
  )
}

// ── SplitPane ──

function SplitPane({
  node,
  worktreePath,
  focusedId,
  draggingId,
  onFocus,
  onDragStart,
  onDragEnd,
  onDrop,
  onRatioChange,
  onClose,
  canClose,
}: Omit<PaneRendererProps, 'node'> & { node: PaneSplit }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const isH = node.direction === 'horizontal'

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const totalSize = isH ? rect.width : rect.height
      const startOffset = isH ? rect.left : rect.top

      const overlay = document.createElement('div')
      overlay.style.cssText = `position:fixed;inset:0;z-index:9999;cursor:${isH ? 'col-resize' : 'row-resize'};`
      document.body.appendChild(overlay)

      const onMouseMove = (me: MouseEvent): void => {
        const pos = isH ? me.clientX : me.clientY
        const newRatio = (pos - startOffset) / totalSize
        onRatioChange(node.id, newRatio)
      }

      const onMouseUp = (): void => {
        overlay.remove()
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = isH ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    },
    [node.id, isH, onRatioChange],
  )

  const childProps = {
    worktreePath,
    focusedId,
    draggingId,
    onFocus,
    onDragStart,
    onDragEnd,
    onDrop,
    onRatioChange,
    onClose,
    canClose,
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: isH ? 'row' : 'column',
        overflow: 'hidden',
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <div
        style={{
          [isH ? 'width' : 'height']: `${node.ratio * 100}%`,
          display: 'flex',
          overflow: 'hidden',
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <PaneRenderer node={node.first} {...childProps} />
      </div>

      <SplitResizeHandle
        direction={isH ? 'horizontal' : 'vertical'}
        onResizeStart={handleResizeStart}
      />

      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <PaneRenderer node={node.second} {...childProps} />
      </div>
    </div>
  )
}

// ── WorkspaceView ──────────────────────────────────────────────────────────────

interface WorkspaceViewProps {
  worktreePath: string
}

export function WorkspaceView({ worktreePath }: WorkspaceViewProps): JSX.Element {
  const worktreeBase = (worktreePath.split('/').pop() ?? 'workspace').replace(
    /[^a-zA-Z0-9-]/g,
    '-',
  )
  const worktreeName = worktreePath.split('/').pop() ?? 'workspace'

  const makeSessionName = useCallback(
    (panelId: string) => `codrox-${worktreeBase}-${panelId}`,
    [worktreeBase],
  )

  // ── Pane tree state ──
  const [paneTree, setPaneTree] = useState<PaneNode>(() => ({
    type: 'leaf',
    id: 'claude-main',
    panelType: 'claude',
    title: 'Claude',
    sessionName: `codrox-${worktreeBase}-claude-main`,
  }))

  // ── Focus tracking ──
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>('claude-main')

  // ── Drag state ──
  const [draggingPaneId, setDraggingPaneId] = useState<string | null>(null)

  // ── Bottom terminal ──
  const [bottomTerminal, setBottomTerminal] = useState<BottomTerminal>(() => ({
    sessionName: `codrox-${worktreeBase}-terminal-main`,
    collapsed: false,
  }))

  // ── Top/bottom split ──
  const [topBottomSplit, setTopBottomSplit] = useState(75)
  const outerRef = useRef<HTMLDivElement>(null)

  // ── Add panel (splits alongside the focused pane) ──
  const addPanel = useCallback(
    (type: 'claude' | 'terminal') => {
      const id = `${type}-${Date.now()}`
      const titles = { claude: 'Claude', terminal: 'Terminal' }
      const newLeaf: PaneLeaf = {
        type: 'leaf',
        id,
        panelType: type,
        title: titles[type],
        sessionName: makeSessionName(id),
      }

      setPaneTree((prev) => {
        const targetId = focusedPaneId && findLeafById(prev, focusedPaneId)
          ? focusedPaneId
          : findFirstLeafId(prev)
        return insertAtPane(prev, targetId, newLeaf, 'right')
      })
      setFocusedPaneId(id)
    },
    [makeSessionName, focusedPaneId],
  )

  // ── Close panel ──
  const closePanel = useCallback(
    (id: string) => {
      setPaneTree((prev) => {
        if (countLeaves(prev) <= 1) return prev // keep at least one
        const result = removePane(prev, id)
        return result ?? prev
      })
      if (focusedPaneId === id) setFocusedPaneId(null)
    },
    [focusedPaneId],
  )

  // ── Drop handler (VS Code style) ──
  const handleDrop = useCallback(
    (targetId: string, zone: DropZone) => {
      if (!draggingPaneId || draggingPaneId === targetId) return

      setPaneTree((prev) => {
        const draggedLeaf = findLeafById(prev, draggingPaneId)
        if (!draggedLeaf) return prev

        // Remove the dragged pane
        let tree = removePane(prev, draggingPaneId)
        if (!tree) return prev

        // Center → insert right
        const effectiveZone = zone === 'center' ? 'right' : zone

        // Insert at target position with the chosen zone
        tree = insertAtPane(tree, targetId, { ...draggedLeaf }, effectiveZone)
        return tree
      })

      setDraggingPaneId(null)
    },
    [draggingPaneId],
  )

  // ── Ratio change ──
  const handleRatioChange = useCallback((splitId: string, ratio: number) => {
    setPaneTree((prev) => updateRatio(prev, splitId, ratio))
  }, [])

  // ── Top/Bottom vertical resize ──
  const handleVerticalResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const container = outerRef.current
    if (!container) return
    const containerHeight = container.getBoundingClientRect().height
    const startSplit = topBottomSplit

    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;cursor:row-resize;'
    document.body.appendChild(overlay)

    const onMouseMove = (me: MouseEvent): void => {
      const currentY = me.clientY
      const offset = currentY - container.getBoundingClientRect().top
      const newPct = (offset / containerHeight) * 100
      setTopBottomSplit(Math.max(30, Math.min(85, newPct)))
    }

    const onMouseUp = (): void => {
      overlay.remove()
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    void startSplit
  }, [topBottomSplit])

  // ── Toggle bottom terminal collapse ──
  const toggleBottomCollapse = useCallback(() => {
    setBottomTerminal((prev) => ({ ...prev, collapsed: !prev.collapsed }))
  }, [])

  const isBottomFocused = focusedPaneId === 'bottom-terminal'
  const bottomHeightStyle = bottomTerminal.collapsed ? 28 : `${100 - topBottomSplit}%`
  const leafCount = countLeaves(paneTree)

  // ── File tabs from store ──
  const openFiles = useFileTreeStore((s) => s.openFiles)
  const activeTab = useFileTreeStore((s) => s.activeTab)
  const setActiveTab = useFileTreeStore((s) => s.setActiveTab)
  const closeFile = useFileTreeStore((s) => s.closeFile)

  const isWorkTab = activeTab === 'work'

  return (
    <div
      ref={outerRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
      {/* ── Worktree header with tabs ── */}
      <div
        style={{
          height: 32,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'stretch',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          userSelect: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Work tab */}
        <div
          onClick={() => setActiveTab('work')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 12px',
            cursor: 'pointer',
            borderBottom: isWorkTab ? '2px solid var(--accent)' : '2px solid transparent',
            background: isWorkTab ? 'var(--surface2)' : 'transparent',
            transition: 'background .1s',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--mono)',
              fontWeight: 600,
              color: isWorkTab ? 'var(--text)' : 'var(--text3)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {worktreeName}
          </span>
          <span
            style={{
              fontSize: 9,
              fontFamily: 'var(--mono)',
              color: 'var(--text3)',
              flexShrink: 0,
            }}
          >
            {leafCount}
          </span>
        </div>

        {/* File & agent tabs */}
        {openFiles.map((tabKey) => {
          const isAgent = tabKey.startsWith('agent:')
          const isAgentOutput = tabKey.startsWith('agent-output:')
          const displayName = isAgent
            ? tabKey.slice(6).replace(/^@/, '')
            : isAgentOutput
              ? tabKey.slice(13).slice(0, 8) + '…'
              : tabKey.split('/').pop() ?? tabKey
          const isActive = activeTab === tabKey
          const isMd = !isAgent && !isAgentOutput && /\.md$/i.test(displayName)
          const icon = (isAgent || isAgentOutput) ? '⊛' : isMd ? '¶' : '○'
          const iconColor = (isAgent || isAgentOutput) ? 'var(--green)' : 'var(--text3)'

          return (
            <div
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '0 8px',
                cursor: 'pointer',
                borderBottom: isActive ? `2px solid ${isAgent ? 'var(--green)' : 'var(--accent)'}` : '2px solid transparent',
                background: isActive ? 'var(--surface2)' : 'transparent',
                transition: 'background .1s',
                maxWidth: 160,
                overflow: 'hidden',
              }}
            >
              <span style={{ fontSize: 9, color: iconColor, flexShrink: 0 }}>
                {icon}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--mono)',
                  fontWeight: 500,
                  color: isActive ? 'var(--text)' : 'var(--text3)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeFile(tabKey)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text3)',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '0 1px',
                  lineHeight: 1,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
              >
                ×
              </button>
            </div>
          )
        })}

        <div style={{ flex: 1 }} />

        {/* + buttons only on work tab */}
        {isWorkTab && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px' }}>
              <HeaderButton type="terminal" onClick={() => addPanel('terminal')}>
                + Terminal
              </HeaderButton>
              <HeaderButton type="claude" onClick={() => addPanel('claude')}>
                + Claude
              </HeaderButton>
            </div>
          </>
        )}
      </div>

      {/* ── Top section — pane tree OR file preview ── */}
      <div
        style={{
          flex: bottomTerminal.collapsed ? 1 : undefined,
          height: bottomTerminal.collapsed ? undefined : `${topBottomSplit}%`,
          display: 'flex',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Work tab: pane tree — hidden (not unmounted) when viewing files */}
        <div style={{ flex: 1, display: isWorkTab ? 'flex' : 'none', overflow: 'hidden', minHeight: 0 }}>
          <PaneRenderer
            node={paneTree}
            worktreePath={worktreePath}
            focusedId={focusedPaneId}
            draggingId={draggingPaneId}
            onFocus={setFocusedPaneId}
            onDragStart={setDraggingPaneId}
            onDragEnd={() => setDraggingPaneId(null)}
            onDrop={handleDrop}
            onRatioChange={handleRatioChange}
            onClose={closePanel}
            canClose={leafCount > 1}
          />
        </div>

        {/* File preview tab */}
        {!isWorkTab && !activeTab.startsWith('agent:') && !activeTab.startsWith('agent-output:') && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
            <FileViewer />
          </div>
        )}

        {/* Agent terminal tab */}
        {!isWorkTab && activeTab.startsWith('agent:') && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a0a0b' }}>
            <PanelTerminal
              key={activeTab}
              sessionName={activeTab.slice(6)}
              worktreePath={worktreePath}
              type="terminal"
            />
          </div>
        )}

        {/* Agent output viewer — renders JSONL conversation */}
        {!isWorkTab && activeTab.startsWith('agent-output:') && (
          <AgentOutputViewer
            key={activeTab}
            agentId={activeTab.slice(13)}
          />
        )}
      </div>

      {/* ── Vertical resize handle ── */}
      {!bottomTerminal.collapsed && (
        <SplitResizeHandle
          direction="vertical"
          onResizeStart={handleVerticalResizeStart}
        />
      )}

      {/* ── Bottom terminal section ── */}
      <div
        onMouseDown={() => setFocusedPaneId('bottom-terminal')}
        style={{
          height: bottomHeightStyle,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          borderTop: bottomTerminal.collapsed
            ? '1px solid var(--border)'
            : undefined,
        }}
      >
        {/* Focus ring for bottom terminal */}
        {isBottomFocused && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: '1px solid var(--accent)',
              borderRadius: 1,
              pointerEvents: 'none',
              zIndex: 5,
            }}
          />
        )}

        {/* Bottom terminal header */}
        <div
          style={{
            height: 28,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            background: isBottomFocused ? 'var(--surface2)' : 'var(--surface)',
            borderBottom: isBottomFocused
              ? '2px solid var(--accent)'
              : '1px solid var(--border)',
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
            title={
              bottomTerminal.collapsed ? 'Expand terminal' : 'Collapse terminal'
            }
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
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text3)'
            }}
          >
            {bottomTerminal.collapsed ? '▸' : '▾'}
          </button>
        </div>

        {/* Bottom terminal content — hidden (not unmounted) when collapsed */}
        <div style={{ flex: 1, display: bottomTerminal.collapsed ? 'none' : 'flex', overflow: 'hidden', minHeight: 0 }}>
          <PanelTerminal
            sessionName={bottomTerminal.sessionName}
            worktreePath={worktreePath}
            type="terminal"
          />
        </div>
      </div>
    </div>
  )
}

// ── HeaderButton ──────────────────────────────────────────────────────────────

interface HeaderButtonProps {
  type: 'claude' | 'terminal'
  onClick: () => void
  children: React.ReactNode
}

function HeaderButton({
  type,
  onClick,
  children,
}: HeaderButtonProps): JSX.Element {
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
        e.currentTarget.style.background = isAccent
          ? 'var(--accent)'
          : 'var(--green)'
        e.currentTarget.style.color = isAccent ? '#fff' : '#000'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isAccent
          ? 'var(--accent-dim)'
          : 'var(--green-dim)'
        e.currentTarget.style.color = isAccent
          ? 'var(--accent2)'
          : 'var(--green)'
      }}
    >
      {children}
    </button>
  )
}
