import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useState } from 'react'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { FileTree } from '@renderer/components/FileTree'
import { GitChanges } from '@renderer/components/GitChanges'
import { AgentList } from '@renderer/components/AgentList'

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
  const tree = useFileTreeStore((s) =>
    activeWorktreePath ? s.treeByWorktree[activeWorktreePath] : null
  )

  const [filesCollapsed, setFilesCollapsed] = useState(false)
  const [agentsCollapsed, setAgentsCollapsed] = useState(false)

  const fileCount = tree?.children?.length ?? 0

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
          {/* Agents section */}
          <div style={{ flexShrink: 0 }}>
            <CollapsibleSectionHeader
              label="Agents"
              collapsed={agentsCollapsed}
              onToggle={() => setAgentsCollapsed((c) => !c)}
            />
            {!agentsCollapsed && <AgentList />}
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
              fontSize: 9,
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
