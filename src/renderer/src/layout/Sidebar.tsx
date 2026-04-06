import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useState, useEffect } from 'react'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
// FileTree and GitChanges moved to RightPanel
import type { Workspace, Worktree } from '@shared/types'

// Stable color palette for workspace dots
const DOT_COLORS = [
  '#7c6af7', // accent
  '#3ecf8e', // green
  '#60a5fa', // blue
  '#f472b6', // pink
  '#f59e0b', // amber
  '#f87171', // red
]

function getDotColor(index: number): string {
  return DOT_COLORS[index % DOT_COLORS.length]
}

type SidebarView = 'explorer' | 'settings'

// ── Activity Bar ──────────────────────────────────────────────────────────────

function ActivityBar({
  activeView,
  onSelect,
}: {
  activeView: SidebarView
  onSelect: (view: SidebarView) => void
}): JSX.Element {
  const [hoveredId, setHoveredId] = useState<SidebarView | null>(null)

  const items: { id: SidebarView; icon: string; label: string }[] = [
    { id: 'explorer', icon: '◈', label: 'Explorer' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ]

  return (
    <div
      style={{
        width: 48,
        minWidth: 48,
        background: 'var(--bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 8,
        gap: 4,
        height: '100%',
        flexShrink: 0,
      }}
    >
      {items.map((item) => {
        const isActive = activeView === item.id
        const isHovered = hoveredId === item.id
        return (
          <div
            key={item.id}
            title={item.label}
            onClick={() => onSelect(item.id)}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              position: 'relative',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: 6,
              fontSize: 16,
              color: isActive ? 'var(--accent2)' : isHovered ? 'var(--text2)' : 'var(--text3)',
              background: isActive
                ? 'var(--accent-dim)'
                : isHovered
                  ? 'var(--surface2)'
                  : 'transparent',
              transition: 'all .12s',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {item.icon}
            {isHovered && (
              <div
                style={{
                  position: 'absolute',
                  left: 46,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'var(--surface3)',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  padding: '4px 8px',
                  fontSize: 10,
                  color: 'var(--text2)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 100,
                  letterSpacing: '0.06em',
                }}
              >
                {item.label}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({
  label,
  onAdd,
  addTitle,
}: {
  label: string
  onAdd?: () => void
  addTitle?: string
}): JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{
        padding: '10px 14px 6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: 'var(--text3)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {onAdd && (
        <button
          onClick={onAdd}
          title={addTitle}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: hovered ? 'var(--accent2)' : 'var(--text3)',
            fontSize: 18,
            lineHeight: 1,
            padding: '0 2px',
            transition: 'color .12s',
          }}
        >
          +
        </button>
      )}
    </div>
  )
}

// ── Inline new-worktree input ──────────────────────────────────────────────────

function NewWorktreeInline({
  onSubmit,
  onCancel,
}: {
  onSubmit: (branch: string) => void
  onCancel: () => void
}): JSX.Element {
  const [branch, setBranch] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && branch.trim()) {
      onSubmit(branch.trim())
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 26,
        paddingLeft: 36,
        paddingRight: 8,
        gap: 4,
      }}
    >
      <input
        value={branch}
        onChange={(e) => setBranch(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="branch name…"
        autoFocus
        style={{
          flex: 1,
          padding: '2px 6px',
          fontSize: 11,
          background: 'var(--surface2)',
          border: '1px solid var(--accent)',
          borderRadius: 4,
          color: 'var(--text)',
          fontFamily: 'var(--mono)',
          outline: 'none',
          height: 20,
        }}
      />
      <button
        onClick={onCancel}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text3)',
          fontSize: 12,
          lineHeight: 1,
          padding: '0 2px',
        }}
      >
        ×
      </button>
    </div>
  )
}

// ── Workspace tree node ────────────────────────────────────────────────────────

function WorkspaceNode({
  workspace,
  index,
  isExpanded,
  isActiveWorkspace,
  activeWorktreeId,
  worktrees,
  onToggleExpand,
  onSelectWorktree,
  onRemoveWorkspace,
  onRemoveWorktree,
  onCreateWorktree,
}: {
  workspace: Workspace
  index: number
  isExpanded: boolean
  isActiveWorkspace: boolean
  activeWorktreeId: string | null
  worktrees: Worktree[]
  onToggleExpand: () => void
  onSelectWorktree: (worktreeId: string | null) => void
  onRemoveWorkspace: () => void
  onRemoveWorktree: (worktreePath: string) => void
  onCreateWorktree: (workspaceId: string, branch: string) => void
}): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const [showNewWorktree, setShowNewWorktree] = useState(false)
  const dotColor = getDotColor(index)

  // Sort: main first, then rest
  const sorted = [...worktrees].sort((a, b) => {
    if (a.isMain && !b.isMain) return -1
    if (!a.isMain && b.isMain) return 1
    return 0
  })

  const handleCreateWorktree = (branch: string): void => {
    setShowNewWorktree(false)
    onCreateWorktree(workspace.id, branch)
  }

  // The "active" worktree for display — if no activeWorktreeId, the main one is implicitly active
  const effectiveActiveId = activeWorktreeId

  return (
    <div>
      {/* Workspace row */}
      <div
        onClick={onToggleExpand}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 28,
          paddingLeft: 8,
          paddingRight: 8,
          cursor: 'pointer',
          background: isActiveWorkspace && !effectiveActiveId
            ? 'var(--accent-dim)'
            : hovered
              ? 'var(--surface2)'
              : 'transparent',
          borderLeft: isActiveWorkspace && !effectiveActiveId
            ? '2px solid var(--accent)'
            : '2px solid transparent',
          gap: 5,
          position: 'relative',
        }}
      >
        {/* Expand/collapse arrow */}
        <span
          style={{
            fontSize: 9,
            color: 'var(--text3)',
            width: 10,
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          {isExpanded ? '▾' : '▸'}
        </span>
        {/* Colored dot */}
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
        />
        {/* Name */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: isActiveWorkspace ? 'var(--text)' : 'var(--text2)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {workspace.name}
        </span>
        {/* Remove on hover */}
        {hovered && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemoveWorkspace()
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text3)',
              fontSize: 12,
              lineHeight: 1,
              padding: '0 2px',
              flexShrink: 0,
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

      {/* Children: worktrees */}
      {isExpanded && (
        <div>
          {sorted.map((wt) => {
            const isActive = isActiveWorkspace && (
              wt.isMain ? effectiveActiveId === null : effectiveActiveId === wt.id
            )
            return (
              <WorktreeNode
                key={wt.id}
                worktree={wt}
                isActive={isActive}
                onSelect={() => onSelectWorktree(wt.isMain ? null : wt.id)}
                onRemove={() => onRemoveWorktree(wt.path)}
              />
            )
          })}

          {/* New worktree inline */}
          {showNewWorktree ? (
            <NewWorktreeInline
              onSubmit={handleCreateWorktree}
              onCancel={() => setShowNewWorktree(false)}
            />
          ) : (
            <NewWorktreeButton onClick={() => setShowNewWorktree(true)} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Worktree node ──────────────────────────────────────────────────────────────

function WorktreeNode({
  worktree,
  isActive,
  onSelect,
  onRemove,
}: {
  worktree: Worktree
  isActive: boolean
  onSelect: () => void
  onRemove: () => void
}): JSX.Element {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 26,
        paddingLeft: 28,
        paddingRight: 8,
        cursor: 'pointer',
        background: isActive ? 'var(--accent-dim)' : hovered ? 'var(--surface2)' : 'transparent',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        gap: 5,
        position: 'relative',
      }}
    >
      {/* dot */}
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: worktree.isMain ? 'var(--green)' : 'var(--text3)',
          flexShrink: 0,
        }}
      />
      {/* branch / name */}
      <span
        style={{
          fontSize: 11,
          color: isActive ? 'var(--text)' : 'var(--text2)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {worktree.branch || worktree.name}
      </span>
      {/* remove non-main on hover */}
      {hovered && !worktree.isMain && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text3)',
            fontSize: 12,
            lineHeight: 1,
            padding: '0 2px',
            flexShrink: 0,
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
  )
}

// ── "New worktree..." button ───────────────────────────────────────────────────

function NewWorktreeButton({ onClick }: { onClick: () => void }): JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 24,
        paddingLeft: 36,
        paddingRight: 8,
        cursor: 'pointer',
        gap: 4,
        opacity: hovered ? 1 : 0.5,
        transition: 'opacity .12s',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--text3)' }}>+</span>
      <span style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.04em' }}>
        New worktree...
      </span>
    </div>
  )
}

// ── Workspace tree (top section) ──────────────────────────────────────────────

function WorkspaceTree({ onAddWorkspace }: { onAddWorkspace: () => void }): JSX.Element {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const activeWorktreeId = useWorkspaceStore((s) => s.activeWorktreeId)
  const worktreesByWorkspace = useWorkspaceStore((s) => s.worktreesByWorkspace)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const setActiveWorktree = useWorkspaceStore((s) => s.setActiveWorktree)
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace)
  const removeWorktree = useWorkspaceStore((s) => s.removeWorktree)
  const loadWorktrees = useWorkspaceStore((s) => s.loadWorktrees)
  const createWorktree = useWorkspaceStore((s) => s.createWorktree)

  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(
    () => new Set(activeWorkspaceId ? [activeWorkspaceId] : []),
  )

  // Auto-expand when active workspace changes
  useEffect(() => {
    if (activeWorkspaceId) {
      setExpandedWorkspaces((prev) => {
        const next = new Set(prev)
        next.add(activeWorkspaceId)
        return next
      })
    }
  }, [activeWorkspaceId])

  const handleToggleExpand = (workspaceId: string, workspace: Workspace): void => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev)
      if (next.has(workspaceId)) {
        next.delete(workspaceId)
      } else {
        next.add(workspaceId)
        // Load worktrees when expanding
        loadWorktrees(workspaceId, workspace.path).catch(() => {})
      }
      return next
    })
    // Clicking workspace header also selects the workspace (clears worktree selection)
    setActiveWorkspace(workspaceId)
  }

  const handleSelectWorktree = (workspaceId: string, worktreeId: string | null): void => {
    setActiveWorkspace(workspaceId)
    setActiveWorktree(worktreeId)
  }

  const handleCreateWorktree = async (workspaceId: string, branch: string): Promise<void> => {
    const workspace = workspaces.find((w) => w.id === workspaceId)
    if (!workspace) return
    try {
      await createWorktree(workspaceId, workspace.path, branch, branch)
    } catch {
      // ignore
    }
  }

  const handleRemoveWorktree = async (workspaceId: string, worktreePath: string): Promise<void> => {
    await removeWorktree(workspaceId, worktreePath)
  }

  // Load worktrees for already-expanded workspaces on mount
  useEffect(() => {
    expandedWorkspaces.forEach((wsId) => {
      const ws = workspaces.find((w) => w.id === wsId)
      if (ws) {
        loadWorktrees(ws.id, ws.path).catch(() => {})
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ flexShrink: 0 }}>
      <SectionHeader label="Workspaces" onAdd={onAddWorkspace} addTitle="Add workspace" />
      {workspaces.length === 0 ? (
        <p
          style={{
            fontSize: 10,
            color: 'var(--text3)',
            padding: '8px 14px 12px',
            lineHeight: 1.6,
          }}
        >
          Click + to add a workspace
        </p>
      ) : (
        <div style={{ paddingBottom: 4 }}>
          {workspaces.map((ws, i) => (
            <WorkspaceNode
              key={ws.id}
              workspace={ws}
              index={i}
              isExpanded={expandedWorkspaces.has(ws.id)}
              isActiveWorkspace={ws.id === activeWorkspaceId}
              activeWorktreeId={ws.id === activeWorkspaceId ? activeWorktreeId : null}
              worktrees={worktreesByWorkspace[ws.id] ?? []}
              onToggleExpand={() => handleToggleExpand(ws.id, ws)}
              onSelectWorktree={(wtId) => handleSelectWorktree(ws.id, wtId)}
              onRemoveWorkspace={() => removeWorkspace(ws.id)}
              onRemoveWorktree={(path) => handleRemoveWorktree(ws.id, path)}
              onCreateWorktree={handleCreateWorktree}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Explorer view (workspace tree + file tree + git changes) ──────────────────

function ExplorerView({ onAddWorkspace }: { onAddWorkspace: () => void }): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Workspace + worktree tree — fills the panel */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        <WorkspaceTree onAddWorkspace={onAddWorkspace} />
      </div>

      {/* Placeholder when empty */}
      {useWorkspaceStore.getState().workspaces.length === 0 && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <p
            style={{
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--text3)',
              lineHeight: 1.6,
            }}
          >
            Select a worktree to explore files
          </p>
        </div>
      )}
    </div>
  )
}

// ── Settings view ─────────────────────────────────────────────────────────────

function SettingsView(): JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <p
        style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text3)',
          lineHeight: 1.6,
        }}
      >
        Settings coming soon
      </p>
    </div>
  )
}

// ── Main Sidebar export ────────────────────────────────────────────────────────

export function Sidebar(): JSX.Element {
  const addWorkspace = useWorkspaceStore((s) => s.addWorkspace)
  const [activeView, setActiveView] = useState<SidebarView>('explorer')

  const handleAddWorkspace = async (): Promise<void> => {
    const result = await window.api.invoke('dialog:openDirectory', undefined)
    const path = result as string | null
    if (path) {
      await addWorkspace(path)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
      {/* Activity bar */}
      <ActivityBar activeView={activeView} onSelect={setActiveView} />

      {/* Content panel */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          overflow: 'hidden',
          height: '100%',
          flex: 1,
          minWidth: 0,
        }}
      >
        {activeView === 'explorer' && <ExplorerView onAddWorkspace={handleAddWorkspace} />}
        {activeView === 'settings' && <SettingsView />}
      </div>
    </div>
  )
}
