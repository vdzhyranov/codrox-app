import { useRef, useCallback, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePTY } from '@renderer/hooks/usePTY'
import { useActiveWorkspaceId } from '@renderer/hooks/useActiveWorkspaceId'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { FileViewer } from '@renderer/components/FileViewer'
import { AgentOutputViewer } from '@renderer/components/AgentOutputViewer'
// ── Types ──────────────────────────────────────────────────────────────────────

interface ShellInfo {
  path: string
  name: string
}

interface PaneLeaf {
  type: 'leaf'
  id: string
  panelType: 'claude' | 'terminal'
  title: string
  sessionName: string
  shell?: string
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

interface BottomTab {
  id: string
  sessionName: string
  shell?: string
}

interface BottomTerminalState {
  tabs: BottomTab[]
  activeId: string
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


function updateRatio(root: PaneNode, splitId: string, ratio: number): PaneNode {
  if (root.type === 'leaf') return root
  if (root.id === splitId) return { ...root, ratio: Math.max(0.15, Math.min(0.85, ratio)) }
  return {
    ...root,
    first: updateRatio(root.first, splitId, ratio),
    second: updateRatio(root.second, splitId, ratio),
  }
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
  shell?: string
}

function PanelTerminal({ sessionName, worktreePath, type, shell }: PanelTerminalProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeWorkspaceId = useActiveWorkspaceId()

  usePTY({
    ptyId: sessionName,
    worktreeId: sessionName,
    workspaceId: activeWorkspaceId ?? undefined,
    cwd: worktreePath,
    type,
    containerRef,
    shell,
  })

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


// ── PaneRenderer (recursive) ──────────────────────────────────────────────────

interface PaneRendererProps {
  node: PaneNode
  worktreePath: string
  focusedId: string | null
  onFocus: (id: string) => void
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
  onFocus,
}: Omit<PaneRendererProps, 'node'> & { node: PaneLeaf }): JSX.Element {
  const isFocused = focusedId === node.id

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
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

      <PanelTerminal
        sessionName={node.sessionName}
        worktreePath={worktreePath}
        type={node.panelType}
        shell={node.shell}
      />
    </div>
  )
}

// ── SplitPane ──

function SplitPane({
  node,
  worktreePath,
  focusedId,
  onFocus,
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
    onFocus,
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

  // ── Bottom terminal tabs ──
  const [bottomState, setBottomState] = useState<BottomTerminalState>(() => {
    const id = 'terminal-main'
    return {
      tabs: [{ id, sessionName: `codrox-${worktreeBase}-${id}` }],
      activeId: id,
      collapsed: false,
    }
  })

  // ── Top/bottom split ──
  const [topBottomSplit, setTopBottomSplit] = useState(75)
  const outerRef = useRef<HTMLDivElement>(null)

  // ── Shell picker state (for bottom terminal block) ──
  const defaultShell = useSettingsStore((s) => s.defaultShell)
  const [availableShells, setAvailableShells] = useState<ShellInfo[]>([])
  const [shellDropdownOpen, setShellDropdownOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ bottom: 0, right: 0 })
  const addTerminalButtonRef = useRef<HTMLButtonElement>(null)
  const shellDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;(window.api.invoke('shell:list', undefined) as Promise<ShellInfo[]>)
      .then(setAvailableShells)
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!shellDropdownOpen) return
    const handler = (e: MouseEvent): void => {
      const target = e.target as Node
      const inButton = addTerminalButtonRef.current?.contains(target)
      const inDropdown = shellDropdownRef.current?.contains(target)
      if (!inButton && !inDropdown) setShellDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [shellDropdownOpen])

  // ── Add bottom terminal tab ──
  const addBottomTerminal = useCallback(
    (shell?: string) => {
      const id = `terminal-${Date.now()}`
      const newTab: BottomTab = {
        id,
        sessionName: `codrox-${worktreeBase}-${id}`,
        shell: shell ?? defaultShell ?? undefined,
      }
      setBottomState((prev) => ({ ...prev, tabs: [...prev.tabs, newTab], activeId: id }))
    },
    [worktreeBase, defaultShell],
  )

  // ── Close bottom terminal tab ──
  const closeBottomTerminal = useCallback((id: string) => {
    setBottomState((prev) => {
      if (prev.tabs.length <= 1) return prev
      const tab = prev.tabs.find((t) => t.id === id)
      if (tab) window.api.invoke('pty:destroy', { id: tab.sessionName })
      const newTabs = prev.tabs.filter((t) => t.id !== id)
      const newActiveId =
        prev.activeId === id ? (newTabs[newTabs.length - 1]?.id ?? newTabs[0]?.id ?? '') : prev.activeId
      return { ...prev, tabs: newTabs, activeId: newActiveId }
    })
  }, [])

  // ── Close pane ──
  const closePanel = useCallback(
    (id: string) => {
      setPaneTree((prev) => {
        if (countLeaves(prev) <= 1) return prev
        const leaf = findLeafById(prev, id)
        if (leaf) {
          window.api.invoke('pty:destroy', { id: leaf.sessionName })
        }
        const result = removePane(prev, id)
        return result ?? prev
      })
      if (focusedPaneId === id) setFocusedPaneId(null)
    },
    [focusedPaneId],
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
    setBottomState((prev) => ({ ...prev, collapsed: !prev.collapsed }))
  }, [])

  const isBottomFocused = focusedPaneId === 'bottom-terminal'
  const bottomHeightStyle = bottomState.collapsed ? 28 : `${100 - topBottomSplit}%`
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
      </div>

      {/* ── Top section — pane tree OR file preview ── */}
      <div
        style={{
          flex: bottomState.collapsed ? 1 : undefined,
          height: bottomState.collapsed ? undefined : `${topBottomSplit}%`,
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
            onFocus={setFocusedPaneId}
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
      {!bottomState.collapsed && (
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
          borderTop: bottomState.collapsed ? '1px solid var(--border)' : undefined,
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

        {/* Bottom terminal header — tabs + add button + collapse */}
        <div
          style={{
            height: 28,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            background: isBottomFocused ? 'var(--surface2)' : 'var(--surface)',
            borderBottom: isBottomFocused ? '2px solid var(--accent)' : '1px solid var(--border)',
            borderTop: '1px solid var(--border)',
            userSelect: 'none',
            overflow: 'hidden',
          }}
        >
          {/* Terminal label */}
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--mono)',
              fontWeight: 600,
              color: 'var(--green)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '0 8px',
              flexShrink: 0,
            }}
          >
            Terminal
          </span>

          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, overflow: 'hidden', height: '100%' }}>
            {bottomState.tabs.map((tab, i) => {
              const isActive = tab.id === bottomState.activeId
              return (
                <div
                  key={tab.id}
                  onClick={() => setBottomState((prev) => ({ ...prev, activeId: tab.id }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '0 8px',
                    cursor: 'pointer',
                    borderBottom: isActive ? '2px solid var(--green)' : '2px solid transparent',
                    background: isActive ? 'var(--surface3)' : 'transparent',
                    borderRight: '1px solid var(--border)',
                    transition: 'background .1s',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: 'var(--mono)',
                      color: isActive ? 'var(--green)' : 'var(--text3)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.shell ? tab.shell.split('/').pop() : `bash`} {i + 1}
                  </span>
                  {bottomState.tabs.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); closeBottomTerminal(tab.id) }}
                      title="Close terminal"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text3)',
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: 0,
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
              )
            })}
          </div>

          {/* Add terminal button with shell picker */}
          <div style={{ display: 'flex', flexShrink: 0 }}>
            <button
              ref={addTerminalButtonRef}
              onClick={() => {
                if (availableShells.length > 1) {
                  const rect = addTerminalButtonRef.current?.getBoundingClientRect()
                  if (rect) setDropdownPos({ bottom: window.innerHeight - rect.top, right: window.innerWidth - rect.right })
                  setShellDropdownOpen((v) => !v)
                } else {
                  addBottomTerminal()
                }
              }}
              title="New terminal"
              style={{
                height: 20,
                padding: '0 8px',
                margin: '0 4px',
                borderRadius: 3,
                fontSize: 10,
                fontFamily: 'var(--mono)',
                cursor: 'pointer',
                background: 'var(--green-dim)',
                color: 'var(--green)',
                border: '1px solid var(--green)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                transition: 'background .1s, color .1s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--green)'; e.currentTarget.style.color = '#000' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--green-dim)'; e.currentTarget.style.color = 'var(--green)' }}
            >
              + {availableShells.length > 1 ? '▾' : ''}
            </button>
          </div>
          {shellDropdownOpen && createPortal(
            <div
              ref={shellDropdownRef}
              style={{
                position: 'fixed',
                bottom: dropdownPos.bottom + 4,
                right: dropdownPos.right,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                zIndex: 9999,
                minWidth: 180,
                boxShadow: '0 4px 16px rgba(0,0,0,.4)',
                overflow: 'hidden',
              }}
            >
              {availableShells.map((s) => (
                <button
                  key={s.path}
                  onClick={() => { addBottomTerminal(s.path); setShellDropdownOpen(false) }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    width: '100%',
                    padding: '6px 10px',
                    background: s.path === (defaultShell ?? availableShells[0]?.path) ? 'var(--surface3)' : 'transparent',
                    color: 'var(--text)',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    gap: 1,
                    transition: 'background .1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-dim)' }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = s.path === (defaultShell ?? availableShells[0]?.path) ? 'var(--surface3)' : 'transparent'
                  }}
                >
                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600 }}>{s.name}</span>
                  <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{s.path}</span>
                </button>
              ))}
            </div>,
            document.body
          )}

          {/* Collapse button */}
          <button
            onClick={toggleBottomCollapse}
            title={bottomState.collapsed ? 'Expand terminal' : 'Collapse terminal'}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text3)',
              cursor: 'pointer',
              fontSize: 10,
              padding: '0 8px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
          >
            {bottomState.collapsed ? '▸' : '▾'}
          </button>
        </div>

        {/* Bottom terminal content — only active tab rendered; PTY stays alive in main process */}
        <div style={{ flex: 1, display: bottomState.collapsed ? 'none' : 'flex', overflow: 'hidden', minHeight: 0 }}>
          {bottomState.tabs.map((tab) =>
            tab.id === bottomState.activeId ? (
              <PanelTerminal
                key={tab.id}
                sessionName={tab.sessionName}
                worktreePath={worktreePath}
                type="terminal"
                shell={tab.shell}
              />
            ) : null
          )}
        </div>
      </div>
    </div>
  )
}

