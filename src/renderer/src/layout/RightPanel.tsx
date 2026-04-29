import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useState, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { FileTree } from '@renderer/components/FileTree'
import { GitChanges } from '@renderer/components/GitChanges'
import { AgentList } from '@renderer/components/AgentList'
import { BrowserTabs } from '@renderer/components/BrowserTabs'
import { GraphPanel } from '@renderer/components/GraphPanel'
import { TokenUsagePanel } from '@renderer/components/TokenUsagePanel'

type RightPanelMode = 'panel' | 'browser'

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
          fontSize: 'var(--fs-xs)',
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
          fontSize: 'var(--fs-xs)',
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
            fontSize: 'var(--fs-xs)',
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
  const tree = useFileTreeStore((s) =>
    activeWorktreePath ? s.treeByWorktree[activeWorktreePath] : null
  )

  const [mode, setMode] = useState<RightPanelMode>('panel')
  const [filesCollapsed, setFilesCollapsed] = useState(false)
  const [agentsCollapsed, setAgentsCollapsed] = useState(false)
  const [tokensCollapsed, setTokensCollapsed] = useState(false)
  const [graphCollapsed, setGraphCollapsed] = useState(true)

  const fileCount = tree?.children?.length ?? 0

  // Auto-switch to browser when a link is opened
  const switchToBrowser = useCallback(() => setMode('browser'), [])
  const switchToPanel = useCallback(() => setMode('panel'), [])

  useEffect(() => {
    const handler = (): void => switchToBrowser()
    window.addEventListener('open-in-browser', handler)
    const unsubIpc = window.api.on('browser:open-url', () => switchToBrowser())
    return () => {
      window.removeEventListener('open-in-browser', handler)
      unsubIpc()
    }
  }, [switchToBrowser])

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
      {mode === 'browser' ? (
        <BrowserTabs onSwitchToPanel={switchToPanel} />
      ) : activeWorktreePath ? (
        <>
          {/* Mode switch header */}
          <div
            style={{
              height: 32,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'stretch',
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <button
              onClick={switchToBrowser}
              title="Switch to Browser"
              style={{
                width: 28,
                flexShrink: 0,
                border: 'none',
                background: 'transparent',
                color: 'var(--text3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--fs-icon)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </button>
          </div>

          {/* Agents section */}
          <div style={{ flexShrink: 0 }}>
            <CollapsibleSectionHeader
              label="Agents"
              collapsed={agentsCollapsed}
              onToggle={() => setAgentsCollapsed((c) => !c)}
            />
            {!agentsCollapsed && <AgentList />}
          </div>

          {/* Token usage section */}
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)' }}>
            <CollapsibleSectionHeader
              label="Token Usage"
              collapsed={tokensCollapsed}
              onToggle={() => setTokensCollapsed((c) => !c)}
            />
            {!tokensCollapsed && <TokenUsagePanel />}
          </div>

          {/* Graph section */}
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)' }}>
            <CollapsibleSectionHeader
              label="Graph"
              collapsed={graphCollapsed}
              onToggle={() => setGraphCollapsed((c) => !c)}
            />
            {!graphCollapsed && <GraphPanel />}
          </div>

          {/* Git changes section */}
          <GitChanges />

          {/* Files section */}
          <div
            style={{
              flex: filesCollapsed ? undefined : 1,
              flexShrink: filesCollapsed ? 0 : undefined,
              overflowY: filesCollapsed ? 'hidden' : 'auto',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              borderTop: '1px solid var(--border)',
            }}
          >
            <CollapsibleSectionHeader
              label="Files"
              count={fileCount}
              collapsed={filesCollapsed}
              onToggle={() => setFilesCollapsed((c) => !c)}
            />
            {!filesCollapsed && (
              <div
                style={{
                  overflow: 'auto',
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <FileTree />
              </div>
            )}
          </div>

          {/* Info bar */}
          <div
            style={{
              borderTop: '1px solid var(--border)',
              padding: '6px 12px',
              flexShrink: 0,
              fontSize: 'var(--fs-xs)',
              color: 'var(--text3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeWorktreePath.split('/').pop()}
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
          <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
            {workspaces.length === 0
              ? 'Add a workspace to begin'
              : 'Select a workspace'}
          </p>
        </div>
      )}
    </div>
  )
}
