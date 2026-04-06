import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import { useTabStore } from '@renderer/store/tabStore'
import { FileTree } from '@renderer/components/FileTree'
import { GitChanges } from '@renderer/components/GitChanges'
import type { ClaudeTab as ClaudeTabType, TerminalTab as TerminalTabType } from '@shared/types'

function SectionHeader({ label }: { label: string }): JSX.Element {
  return (
    <div
      style={{
        padding: '8px 12px 4px',
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.12em',
        color: 'var(--text3)',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  )
}

export function RightPanel(): JSX.Element {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorktreePath = useActiveWorktreePath()
  const tabsByWorktree = useTabStore((s) => s.tabsByWorktree)
  const openTab = useTabStore((s) => s.openTab)

  const tabs = activeWorktreePath ? (tabsByWorktree[activeWorktreePath] ?? []) : []

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
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <SectionHeader label="Files" />
            <div style={{ flex: 1 }}>
              <FileTree />
            </div>
          </div>

          {/* Git changes section */}
          <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <SectionHeader label="Changes" />
            <GitChanges />
          </div>

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
