import { useCallback, useEffect, useRef } from 'react'
import { useTabStore } from '@renderer/store/tabStore'
import { TerminalTab } from '@renderer/tabs/TerminalTab'
import { ClaudeTab } from '@renderer/tabs/ClaudeTab'
import { EditorTab } from '@renderer/tabs/EditorTab'
import type { PaneNode, Tab } from '@shared/types'

// ── Tab content renderer ─────────────────────────────────────────────────────

function PaneTabContent({ tab }: { tab: Tab | null }): JSX.Element {
  if (!tab) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ fontSize: 11, color: 'var(--text3)' }}>Select a tab</p>
      </div>
    )
  }
  if (tab.type === 'terminal') return <TerminalTab key={tab.id} tab={tab} />
  if (tab.type === 'claude') return <ClaudeTab key={tab.id} tab={tab} />
  if (tab.type === 'editor') return <EditorTab key={tab.id} tab={tab} />
  return <div />
}

// ── Leaf pane (with toolbar) ─────────────────────────────────────────────────

interface LeafPaneProps {
  paneId: string
  tabId: string | null
  worktreeId: string
  isFocused: boolean
  isRoot: boolean
}

function LeafPane({ paneId, tabId, worktreeId, isFocused, isRoot }: LeafPaneProps): JSX.Element {
  const tabsByWorktree = useTabStore((s) => s.tabsByWorktree)
  const tabs = tabsByWorktree[worktreeId] ?? []
  const splitPane = useTabStore((s) => s.splitPane)
  const closePane = useTabStore((s) => s.closePane)
  const setPaneTab = useTabStore((s) => s.setPaneTab)
  const setFocusedPane = useTabStore((s) => s.setFocusedPane)

  const tab = tabs.find((t) => t.id === tabId) ?? null

  const TAB_CONFIG: Record<string, { dot: string }> = {
    claude: { dot: '#a78bfa' },
    terminal: { dot: '#3ecf8e' },
    editor: { dot: '#60a5fa' },
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        outline: isFocused ? '1px solid var(--accent-dim)' : 'none',
        outlineOffset: -1,
      }}
      onClick={() => setFocusedPane(worktreeId, paneId)}
    >
      {/* Pane toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 24,
          flexShrink: 0,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '0 4px',
          gap: 4,
        }}
      >
        {/* Tab selector */}
        <select
          value={tabId ?? ''}
          onChange={(e) => {
            if (e.target.value) setPaneTab(worktreeId, paneId, e.target.value)
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 10,
            fontFamily: 'var(--mono)',
            background: 'var(--surface2)',
            color: tabId ? 'var(--text2)' : 'var(--text3)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            padding: '1px 4px',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {tabs.length === 0 && (
            <option value="">No tabs</option>
          )}
          {tabs.map((t) => {
            const dot = TAB_CONFIG[t.type]?.dot ?? 'var(--text3)'
            return (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            )
          })}
        </select>

        {/* Active tab dot indicator */}
        {tab && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: TAB_CONFIG[tab.type]?.dot ?? 'var(--text3)',
              flexShrink: 0,
            }}
          />
        )}

        {/* Split horizontal button */}
        <button
          title="Split right"
          onClick={(e) => {
            e.stopPropagation()
            splitPane(worktreeId, paneId, 'horizontal')
          }}
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text3)',
            cursor: 'pointer',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            flexShrink: 0,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text2)'
            e.currentTarget.style.borderColor = 'var(--border2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text3)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          ⊞
        </button>

        {/* Split vertical button */}
        <button
          title="Split down"
          onClick={(e) => {
            e.stopPropagation()
            splitPane(worktreeId, paneId, 'vertical')
          }}
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text3)',
            cursor: 'pointer',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            flexShrink: 0,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text2)'
            e.currentTarget.style.borderColor = 'var(--border2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text3)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          ⊟
        </button>

        {/* Close pane button — hidden when it's the only pane */}
        {!isRoot && (
          <button
            title="Close pane"
            onClick={(e) => {
              e.stopPropagation()
              closePane(worktreeId, paneId)
            }}
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              border: 'none',
              background: 'transparent',
              color: 'var(--text3)',
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              flexShrink: 0,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--red)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text3)'
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PaneTabContent tab={tab} />
      </div>
    </div>
  )
}

// ── Split pane (with resize handle) ─────────────────────────────────────────

interface SplitPaneProps {
  node: PaneNode & { type: 'split' }
  worktreeId: string
  focusedPaneId: string | null
  rootId: string
}

function SplitPane({ node, worktreeId, focusedPaneId, rootId }: SplitPaneProps): JSX.Element {
  const setPaneRatio = useTabStore((s) => s.setPaneRatio)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const isHorizontal = node.direction === 'horizontal'
  const firstSize = `${node.ratio * 100}%`
  const secondSize = `${(1 - node.ratio) * 100}%`

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent): void => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      let ratio: number
      if (isHorizontal) {
        ratio = (e.clientX - rect.left) / rect.width
      } else {
        ratio = (e.clientY - rect.top) / rect.height
      }
      ratio = Math.min(0.85, Math.max(0.15, ratio))
      setPaneRatio(worktreeId, node.id, ratio)
    }
    const onMouseUp = (): void => {
      isDragging.current = false
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isHorizontal, node.id, setPaneRatio, worktreeId])

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* First child */}
      <div
        style={{
          [isHorizontal ? 'width' : 'height']: firstSize,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <PaneRenderer
          node={node.first}
          worktreeId={worktreeId}
          focusedPaneId={focusedPaneId}
          rootId={rootId}
        />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          [isHorizontal ? 'width' : 'height']: 4,
          flexShrink: 0,
          background: 'var(--border)',
          cursor: isHorizontal ? 'col-resize' : 'row-resize',
          transition: 'background .12s',
          zIndex: 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--accent)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--border)'
        }}
      />

      {/* Second child */}
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
        <PaneRenderer
          node={node.second}
          worktreeId={worktreeId}
          focusedPaneId={focusedPaneId}
          rootId={rootId}
        />
      </div>
    </div>
  )
}

// ── Root pane renderer ───────────────────────────────────────────────────────

interface PaneRendererProps {
  node: PaneNode
  worktreeId: string
  focusedPaneId: string | null
  rootId: string
}

export function PaneRenderer({ node, worktreeId, focusedPaneId, rootId }: PaneRendererProps): JSX.Element {
  if (node.type === 'split') {
    return (
      <SplitPane
        node={node}
        worktreeId={worktreeId}
        focusedPaneId={focusedPaneId}
        rootId={rootId}
      />
    )
  }

  // leaf
  return (
    <LeafPane
      paneId={node.id}
      tabId={node.tabId}
      worktreeId={worktreeId}
      isFocused={focusedPaneId === node.id}
      isRoot={node.id === rootId}
    />
  )
}

// ── Connected root component used by MainContent ─────────────────────────────

export function PaneArea({ worktreeId }: { worktreeId: string }): JSX.Element {
  const panesByWorktree = useTabStore((s) => s.panesByWorktree)
  const focusedPaneByWorktree = useTabStore((s) => s.focusedPaneByWorktree)
  const getOrCreatePane = useTabStore((s) => s.getOrCreatePane)

  const root = panesByWorktree[worktreeId] ?? getOrCreatePane(worktreeId)
  const focusedPaneId = focusedPaneByWorktree[worktreeId] ?? null

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PaneRenderer
        node={root}
        worktreeId={worktreeId}
        focusedPaneId={focusedPaneId}
        rootId={root.id}
      />
    </div>
  )
}
