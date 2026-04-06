import { useRef, useState } from 'react'
import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useTabStore } from '@renderer/store/tabStore'
import type { Tab } from '@shared/types'

const TAB_CONFIG: Record<string, { dot: string; label: string }> = {
  claude: { dot: '#a78bfa', label: 'Claude' },
  terminal: { dot: '#3ecf8e', label: 'Terminal' },
  editor: { dot: '#60a5fa', label: 'Editor' },
}

export function TabBar(): JSX.Element {
  const activeWorktreePath = useActiveWorktreePath()
  const tabsByWorktree = useTabStore((s) => s.tabsByWorktree)
  const activeTabByWorktree = useTabStore((s) => s.activeTabByWorktree)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const reorderTab = useTabStore((s) => s.reorderTab)

  const dragTabId = useRef<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  if (!activeWorktreePath) return <div />

  const tabs = tabsByWorktree[activeWorktreePath] ?? []
  const activeTabId = activeTabByWorktree[activeWorktreePath] ?? null

  const handleTabClick = (tabId: string): void => {
    setActiveTab(activeWorktreePath, tabId)
  }

  if (tabs.length === 0) {
    return (
      <div
        style={{
          height: 36,
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}
      />
    )
  }

  const handleDragStart = (tabId: string): void => {
    dragTabId.current = tabId
  }

  const handleDragOver = (e: React.DragEvent, index: number): void => {
    e.preventDefault()
    setDropIndex(index)
  }

  const handleDragLeave = (): void => {
    setDropIndex(null)
  }

  const handleDrop = (e: React.DragEvent, index: number): void => {
    e.preventDefault()
    if (dragTabId.current) {
      reorderTab(activeWorktreePath, dragTabId.current, index)
      dragTabId.current = null
    }
    setDropIndex(null)
  }

  const handleDragEnd = (): void => {
    dragTabId.current = null
    setDropIndex(null)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        height: 36,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '0 4px',
        flexShrink: 0,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {tabs.map((tab: Tab, index: number) => {
        const isActive = activeTabId === tab.id
        const cfg = TAB_CONFIG[tab.type] ?? { dot: 'var(--text3)', label: tab.type }
        const isDragging = dragTabId.current === tab.id
        const showDropBefore = dropIndex === index
        const showDropAfter = dropIndex === tabs.length && index === tabs.length - 1

        return (
          <div
            key={tab.id}
            style={{ display: 'flex', alignItems: 'stretch', position: 'relative', flexShrink: 0 }}
          >
            {/* Drop indicator before this tab */}
            {showDropBefore && (
              <div
                style={{
                  width: 2,
                  alignSelf: 'stretch',
                  background: 'var(--accent)',
                  borderRadius: 1,
                  marginRight: 1,
                  flexShrink: 0,
                }}
              />
            )}

            <div
              draggable
              onDragStart={() => handleDragStart(tab.id)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => handleTabClick(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px',
                height: 32,
                cursor: 'pointer',
                borderRadius: '6px 6px 0 0',
                fontSize: 11,
                fontFamily: 'var(--mono)',
                transition: 'all .12s',
                position: 'relative',
                flexShrink: 0,
                background: isActive ? 'var(--surface2)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--text3)',
                borderTop: isActive ? '1px solid var(--border)' : '1px solid transparent',
                borderLeft: isActive ? '1px solid var(--border)' : '1px solid transparent',
                borderRight: isActive ? '1px solid var(--border)' : '1px solid transparent',
                borderBottom: isActive ? '1px solid var(--surface2)' : '1px solid transparent',
                marginBottom: isActive ? -1 : 0,
                opacity: isDragging ? 0.5 : 1,
                userSelect: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text2)'
                  e.currentTarget.style.background = 'var(--surface2)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text3)'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {/* Type dot */}
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: cfg.dot,
                  flexShrink: 0,
                  opacity: isActive ? 1 : 0.5,
                }}
              />
              {/* Title */}
              <span
                style={{
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.title}
              </span>
              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(activeWorktreePath, tab.id)
                }}
                style={{
                  marginLeft: 2,
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text3)',
                  cursor: 'pointer',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  lineHeight: 1,
                  transition: 'all .12s',
                  opacity: 0,
                }}
                className="tab-close-btn"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface3)'
                  e.currentTarget.style.color = 'var(--text)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text3)'
                }}
              >
                ×
              </button>
            </div>

            {/* Drop indicator after last tab */}
            {showDropAfter && (
              <div
                style={{
                  width: 2,
                  alignSelf: 'stretch',
                  background: 'var(--accent)',
                  borderRadius: 1,
                  marginLeft: 1,
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        )
      })}

    </div>
  )
}
