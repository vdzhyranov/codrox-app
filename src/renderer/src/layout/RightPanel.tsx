import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useState } from 'react'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { useTabStore } from '@renderer/store/tabStore'
import { FileTree } from '@renderer/components/FileTree'
import { GitChanges } from '@renderer/components/GitChanges'
import type { ClaudeTab as ClaudeTabType, TerminalTab as TerminalTabType } from '@shared/types'

function CollapsibleSectionHeader({
  label,
  count,
  collapsed,
  onToggle,
}: {
  label: string
  count?: number
  collapsed: boolean
  onToggle: () => void
}): JSX.Element {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '8px 12px 4px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          fontSize: 9,
          color: 'var(--text3)',
          display: 'inline-block',
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          transition: 'transform .15s',
        }}
      >
        ▾
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: 'var(--text3)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span
          style={{
            fontSize: 9,
            padding: '1px 6px',
            borderRadius: 3,
            background: 'var(--surface3)',
            color: 'var(--text3)',
            border: '1px solid var(--border)',
            fontWeight: 600,
          }}
        >
          {count}
        </span>
      )}
    </div>
  )
}

export function RightPanel(): JSX.Element {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorktreePath = useActiveWorktreePath()
  const tabsByWorktree = useTabStore((s) => s.tabsByWorktree)
  const openTab = useTabStore((s) => s.openTab)
  const tree = useFileTreeStore((s) =>
    activeWorktreePath ? s.treeByWorktree[activeWorktreePath] : null
  )

  const [filesCollapsed, setFilesCollapsed] = useState(false)

  const tabs = activeWorktreePath ? (tabsByWorktree[activeWorktreePath] ?? []) : []
  const fileCount = tree?.children?.length ?? 0

  const handleNewTerminal = (): void => {
    if (!activeWorktreePath) return
    const id = `terminal-${Date.now()}`
    const tab: TerminalTabType = {
      id,
      type: 'terminal',
      title: 'Terminal',
      worktreeId: activeWorktreePath,
      ptyId: id,
    }
    openTab(activeWorktreePath, tab)
  }

  const handleNewClaude = (): void => {
    if (!activeWorktreePath) return
    const id = `claude-${Date.now()}`
    const tab: ClaudeTabType = {
      id,
      type: 'claude',
      title: 'Claude',
      worktreeId: activeWorktreePath,
      ptyId: id,
    }
    openTab(activeWorktreePath, tab)
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      {activeWorktreePath ? (
        <>
          {/* Actions section */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              gap: 6,
              flexShrink: 0,
            }}
          >
            <button
              onClick={handleNewClaude}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 5,
                fontSize: 10,
                fontFamily: 'var(--mono)',
                cursor: 'pointer',
                transition: 'all .12s',
                border: '1px solid rgba(124,106,247,.35)',
                background: 'var(--accent-dim)',
                color: 'var(--accent2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(124,106,247,.22)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent-dim)'
              }}
            >
              <span>◈</span>
              <span>Claude</span>
            </button>

            <button
              onClick={handleNewTerminal}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 5,
                fontSize: 10,
                fontFamily: 'var(--mono)',
                cursor: 'pointer',
                transition: 'all .12s',
                border: '1px solid rgba(62,207,142,.25)',
                background: 'var(--green-dim)',
                color: 'var(--green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(62,207,142,.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--green-dim)'
              }}
            >
              <span>⟩_</span>
              <span>Terminal</span>
            </button>
          </div>

          {/* Files section */}
          <div
            style={{
              flex: filesCollapsed ? 0 : 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              transition: 'flex .2s ease',
            }}
          >
            <CollapsibleSectionHeader
              label="Files"
              count={fileCount}
              collapsed={filesCollapsed}
              onToggle={() => setFilesCollapsed((c) => !c)}
            />
            <div
              style={{
                overflow: 'hidden',
                flex: 1,
                maxHeight: filesCollapsed ? 0 : undefined,
                transition: 'max-height .2s ease',
              }}
            >
              <FileTree />
            </div>
          </div>

          {/* Git changes section — GitChanges renders its own collapsible header */}
          <GitChanges />

          {/* Info bar */}
          <div
            style={{
              borderTop: '1px solid var(--border)',
              padding: '6px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
              fontSize: 9,
              color: 'var(--text3)',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeWorktreePath.split('/').pop()}
            </span>
            <span>{tabs.length} tabs</span>
          </div>
        </>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
            {workspaces.length === 0
              ? 'Add a workspace to begin'
              : 'Select a workspace'}
          </p>
        </div>
      )}
    </div>
  )
}
