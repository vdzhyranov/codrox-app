import { useState, useEffect } from 'react'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import { useSidebarStore } from '@renderer/store/sidebarStore'
import { useLinearStore } from '@renderer/store/linearStore'
import { CreateTaskModal } from '@renderer/components/CreateTaskModal'
import type { Workspace, Worktree, LinearTask } from '@shared/types'

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

export function ActivityBar(): JSX.Element {
  const activeView = useSidebarStore((s) => s.activeView)
  const setActiveView = useSidebarStore((s) => s.setActiveView)
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
            onClick={() => setActiveView(item.id)}
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

// ── Worktree node ──────────────────────────────────────────────────────────────

function WorktreeNode({
  worktree,
  isActive,
  onSelect,
  onRemove,
  onRename,
}: {
  worktree: Worktree
  isActive: boolean
  onSelect: () => void
  onRemove: () => void
  onRename?: (newName: string) => void
}): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(worktree.branch || worktree.name)
  const linkedTask = useLinearStore((s) => s.linkedTasks[worktree.path])
  const loadLinkedTask = useLinearStore((s) => s.loadLinkedTask)

  useEffect(() => {
    loadLinkedTask(worktree.path)
  }, [worktree.path])

  const handleDoubleClick = (e: React.MouseEvent): void => {
    if (worktree.isMain || !onRename) return
    e.stopPropagation()
    setEditing(true)
    setEditValue(worktree.branch || worktree.name)
  }

  const handleRenameSubmit = (): void => {
    if (editValue.trim() && onRename) {
      onRename(editValue.trim())
    }
    setEditing(false)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleRenameSubmit()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 26,
          paddingLeft: 16,
          paddingRight: 8,
          gap: 4,
        }}
      >
        <input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={handleRenameSubmit}
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
      </div>
    )
  }

  return (
    <div
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 26,
        paddingLeft: 16,
        paddingRight: 8,
        cursor: 'pointer',
        background: isActive ? 'var(--accent-dim)' : hovered ? 'var(--surface2)' : 'transparent',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        gap: 6,
        position: 'relative',
      }}
    >
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
      {/* linked Linear task badge */}
      {linkedTask && (
        <span
          title={linkedTask.taskIdentifier}
          style={{
            fontSize: 8,
            color: 'var(--accent2)',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(124,106,247,.25)',
            borderRadius: 3,
            padding: '0 4px',
            fontFamily: 'var(--mono)',
            flexShrink: 0,
            lineHeight: '14px',
          }}
        >
          {linkedTask.taskIdentifier}
        </span>
      )}
      {/* remove worktree */}
      {!worktree.isMain && (
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
            opacity: hovered ? 1 : 0.3,
            transition: 'opacity .12s, color .12s',
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
        paddingLeft: 24,
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

// ── Workspace selector card ────────────────────────────────────────────────────

function WorkspaceCard({
  workspace,
  index,
  isActive,
  onSelect,
  onRemove,
}: {
  workspace: Workspace
  index: number
  isActive: boolean
  onSelect: () => void
  onRemove: () => void
}): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const [gitBranch, setGitBranch] = useState<string | null>(null)
  const dotColor = getDotColor(index)

  useEffect(() => {
    window.api.invoke('git:branch', { path: workspace.path })
      .then((b) => setGitBranch(b as string | null))
      .catch(() => setGitBranch(null))
  }, [workspace.path])

  const lastOpened = workspace.lastOpened
    ? new Date(workspace.lastOpened).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        margin: '0 10px 8px',
        padding: '10px 12px',
        borderRadius: 8,
        border: isActive
          ? '1px solid rgba(124,106,247,.5)'
          : hovered
            ? '1px solid var(--border2)'
            : '1px solid var(--border)',
        background: isActive
          ? 'rgba(124,106,247,.07)'
          : hovered
            ? 'var(--surface2)'
            : 'var(--surface)',
        cursor: 'pointer',
        transition: 'all .12s',
        position: 'relative',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: isActive ? 'var(--text)' : 'var(--text2)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {workspace.name}
        </span>
        {/* Remove button */}
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
            fontSize: 13,
            lineHeight: 1,
            padding: '0 1px',
            flexShrink: 0,
            opacity: hovered ? 1 : 0.3,
            transition: 'opacity .12s, color .12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
        >
          ×
        </button>
      </div>

      {/* Path */}
      <div
        style={{
          fontSize: 9,
          color: 'var(--text3)',
          fontFamily: 'var(--mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: 6,
        }}
        title={workspace.path}
      >
        {workspace.path}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {gitBranch && (
          <span
            style={{
              fontSize: 9,
              color: 'var(--green)',
              background: 'var(--green-dim)',
              border: '1px solid rgba(62,207,142,.2)',
              borderRadius: 4,
              padding: '1px 5px',
              fontFamily: 'var(--mono)',
            }}
          >
            {gitBranch}
          </span>
        )}
        {lastOpened && (
          <span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 'auto' }}>
            {lastOpened}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Add workspace card ─────────────────────────────────────────────────────────

function AddWorkspaceCard({ onClick }: { onClick: () => void }): JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        margin: '0 10px 8px',
        padding: '10px 12px',
        borderRadius: 8,
        border: hovered ? '1px solid rgba(124,106,247,.4)' : '1px dashed var(--border)',
        background: hovered ? 'rgba(124,106,247,.04)' : 'transparent',
        cursor: 'pointer',
        transition: 'all .12s',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 16, color: hovered ? 'var(--accent2)' : 'var(--text3)', lineHeight: 1 }}>+</span>
      <span
        style={{
          fontSize: 11,
          color: hovered ? 'var(--accent2)' : 'var(--text3)',
          letterSpacing: '0.04em',
        }}
      >
        Add Workspace
      </span>
    </div>
  )
}

// ── Workspace selector (shown when no workspace selected) ──────────────────────

function WorkspaceSelector({ onAddWorkspace }: { onAddWorkspace: () => void }): JSX.Element {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace)
  const loadWorktrees = useWorkspaceStore((s) => s.loadWorktrees)

  const handleSelect = (ws: Workspace): void => {
    setActiveWorkspace(ws.id)
    loadWorktrees(ws.id, ws.path).catch(() => {})
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <SectionHeader label="Workspaces" />
      {workspaces.length === 0 ? (
        <p
          style={{
            fontSize: 10,
            color: 'var(--text3)',
            padding: '8px 14px 12px',
            lineHeight: 1.6,
          }}
        >
          Click below to add a workspace
        </p>
      ) : (
        <div style={{ paddingTop: 4 }}>
          {workspaces.map((ws, i) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              index={i}
              isActive={ws.id === activeWorkspaceId}
              onSelect={() => handleSelect(ws)}
              onRemove={() => removeWorkspace(ws.id)}
            />
          ))}
        </div>
      )}
      <AddWorkspaceCard onClick={onAddWorkspace} />
    </div>
  )
}

// ── Linear task card (draggable) ─────────────────────────────────────────────

function LinearTaskCard({ task }: { task: LinearTask }): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const setDraggedTask = useLinearStore((s) => s.setDraggedTask)

  const priorityLabels: Record<number, { label: string; color: string }> = {
    1: { label: '!!!', color: 'var(--red)' },
    2: { label: '!!', color: '#f59e0b' },
    3: { label: '!', color: 'var(--accent2)' },
    4: { label: '~', color: 'var(--text3)' },
  }
  const prio = priorityLabels[task.priority]

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-linear-task', JSON.stringify({
          id: task.id,
          identifier: task.identifier,
          title: task.title,
          branchName: task.branchName,
        }))
        e.dataTransfer.effectAllowed = 'copy'
        setDraggedTask(task.id)
      }}
      onDragEnd={() => setDraggedTask(null)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 10px',
        margin: '0 8px 4px',
        borderRadius: 6,
        border: hovered ? '1px solid var(--border2)' : '1px solid var(--border)',
        background: hovered ? 'var(--surface2)' : 'var(--surface)',
        cursor: 'grab',
        transition: 'all .12s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        {/* state dot */}
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: task.state.color || 'var(--text3)',
            flexShrink: 0,
          }}
        />
        {/* identifier */}
        <span
          style={{
            fontSize: 9,
            color: 'var(--text3)',
            fontFamily: 'var(--mono)',
            flexShrink: 0,
          }}
        >
          {task.identifier}
        </span>
        {/* priority */}
        {prio && (
          <span style={{ fontSize: 9, color: prio.color, fontFamily: 'var(--mono)', marginLeft: 'auto' }}>
            {prio.label}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.title}
      </div>
    </div>
  )
}

// ── Worktree drop zone (for Linear tasks) ────────────────────────────────────

function WorktreeDropZone({
  onDrop,
}: {
  onDrop: (taskData: { id: string; identifier: string; title: string; branchName: string }) => void
}): JSX.Element {
  const [dragOver, setDragOver] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes('application/x-linear-task')) {
          e.preventDefault()
          setIsDragging(true)
          setDragOver(true)
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-linear-task')) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setDragOver(true)
        }
      }}
      onDragLeave={(e) => {
        // Only hide if leaving the drop zone entirely (not entering a child)
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragOver(false)
          setIsDragging(false)
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        setIsDragging(false)
        const raw = e.dataTransfer.getData('application/x-linear-task')
        if (raw) {
          try {
            onDrop(JSON.parse(raw))
          } catch { /* ignore */ }
        }
      }}
      style={{
        margin: '4px 8px',
        padding: dragOver ? '14px 10px' : '6px 10px',
        borderRadius: 6,
        border: dragOver
          ? '2px solid var(--accent)'
          : '2px dashed rgba(124,106,247,.2)',
        background: dragOver
          ? 'rgba(124,106,247,.12)'
          : 'rgba(124,106,247,.02)',
        textAlign: 'center',
        transition: 'all .15s',
        minHeight: 16,
      }}
    >
      <span style={{
        fontSize: 10,
        color: dragOver ? 'var(--accent2)' : 'var(--text3)',
        opacity: dragOver ? 1 : 0.6,
      }}>
        {dragOver ? 'Release to create worktree' : 'Drop task to create worktree'}
      </span>
    </div>
  )
}

// ── Linear section (auth gate + task list) ───────────────────────────────────

function LinearSection(): JSX.Element {
  const isAuthenticated = useLinearStore((s) => s.isAuthenticated)
  const tasks = useLinearStore((s) => s.tasks)
  const teams = useLinearStore((s) => s.teams)
  const selectedTeamId = useLinearStore((s) => s.selectedTeamId)
  const isLoading = useLinearStore((s) => s.isLoading)
  const error = useLinearStore((s) => s.error)
  const lastFetched = useLinearStore((s) => s.lastFetched)
  const authenticate = useLinearStore((s) => s.authenticate)
  const checkAuth = useLinearStore((s) => s.checkAuth)
  const fetchTasks = useLinearStore((s) => s.fetchTasks)
  const setSelectedTeam = useLinearStore((s) => s.setSelectedTeam)

  const [collapsed, setCollapsed] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [connectHovered, setConnectHovered] = useState(false)
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    checkAuth()
    // Load stored API key (masked — just to know one exists)
    window.api.invoke('linear:getApiKey', undefined)
      .then((result) => {
        const r = result as { apiKey: string }
        if (r.apiKey) setApiKey(r.apiKey)
      })
      .catch(() => {})
  }, [])

  const timeSince = lastFetched
    ? `${Math.round((Date.now() - lastFetched) / 60000)}m ago`
    : null

  return (
    <>
      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />

      {/* Section header */}
      <div
        style={{
          padding: '8px 14px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <span style={{ fontSize: 9, color: 'var(--text3)', transition: 'transform .12s', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
            ▾
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.12em',
              color: 'var(--text3)',
              textTransform: 'uppercase',
            }}
          >
            Linear
          </span>
        </div>
        {isAuthenticated && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setShowCreateModal(true)}
              title="Create issue"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text3)',
                fontSize: 14,
                lineHeight: 1,
                padding: '0 2px',
                transition: 'color .12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
            >
              +
            </button>
            <button
              onClick={() => fetchTasks()}
              title={timeSince ? `Updated ${timeSince}` : 'Refresh'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text3)',
                fontSize: 11,
                lineHeight: 1,
                padding: '0 2px',
                transition: 'color .12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
            >
              ↻
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          {!isAuthenticated ? (
            <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '0.06em' }}>
                  API KEY
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && apiKey.trim()) authenticate(apiKey.trim())
                  }}
                  placeholder="lin_api_..."
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    fontSize: 10,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--text)',
                    fontFamily: 'var(--mono)',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 8, color: 'var(--text3)', lineHeight: 1.4 }}>
                  Linear Settings &gt; Account &gt; API &gt; Personal API keys
                </span>
              </div>
              <button
                onClick={() => authenticate(apiKey.trim())}
                disabled={isLoading || !apiKey.trim()}
                onMouseEnter={() => setConnectHovered(true)}
                onMouseLeave={() => setConnectHovered(false)}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  fontSize: 11,
                  background: connectHovered && apiKey.trim() ? 'var(--accent)' : 'var(--accent-dim)',
                  border: '1px solid var(--accent)',
                  borderRadius: 5,
                  color: connectHovered && apiKey.trim() ? '#fff' : 'var(--accent2)',
                  cursor: isLoading || !apiKey.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--mono)',
                  opacity: isLoading || !apiKey.trim() ? 0.6 : 1,
                  transition: 'all .12s',
                }}
              >
                {isLoading ? 'Connecting...' : 'Connect Linear'}
              </button>
              {error && (
                <span style={{ fontSize: 9, color: 'var(--red)', display: 'block' }}>
                  {error}
                </span>
              )}
            </div>
          ) : (
            <>
              {/* Team filter */}
              {teams.length > 1 && (
                <div style={{ padding: '2px 14px 4px' }}>
                  <select
                    value={selectedTeamId ?? ''}
                    onChange={(e) => setSelectedTeam(e.target.value || null)}
                    style={{
                      width: '100%',
                      padding: '3px 6px',
                      fontSize: 10,
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text2)',
                      fontFamily: 'var(--mono)',
                    }}
                  >
                    <option value="">All teams</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.key} - {t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Task list */}
              {isLoading && tasks.length === 0 ? (
                <div style={{ padding: '8px 14px', fontSize: 10, color: 'var(--text3)' }}>
                  Loading tasks...
                </div>
              ) : error ? (
                <div style={{ padding: '8px 14px', fontSize: 10, color: 'var(--red)' }}>
                  {error}
                </div>
              ) : tasks.length === 0 ? (
                <div style={{ padding: '8px 14px', fontSize: 10, color: 'var(--text3)' }}>
                  No open tasks
                </div>
              ) : (
                <div style={{ paddingTop: 2 }}>
                  {tasks.map((task) => (
                    <LinearTaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}

              {/* Last updated */}
              {timeSince && (
                <div style={{ padding: '4px 14px', fontSize: 9, color: 'var(--text3)', textAlign: 'right' }}>
                  Updated {timeSince}
                </div>
              )}
            </>
          )}
        </>
      )}

      {showCreateModal && (
        <CreateTaskModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  )
}

// ── Active workspace view ─────────────────────────────────────────────────────

function ActiveWorkspaceView({ onBack }: { onBack: () => void }): JSX.Element {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const activeWorktreeId = useWorkspaceStore((s) => s.activeWorktreeId)
  const worktreesByWorkspace = useWorkspaceStore((s) => s.worktreesByWorkspace)
  const setActiveWorktree = useWorkspaceStore((s) => s.setActiveWorktree)
  const removeWorktree = useWorkspaceStore((s) => s.removeWorktree)
  const createWorktree = useWorkspaceStore((s) => s.createWorktree)
  const loadWorktrees = useWorkspaceStore((s) => s.loadWorktrees)

  const linkWorktree = useLinearStore((s) => s.linkWorktree)
  const setDraggedTask = useLinearStore((s) => s.setDraggedTask)
  const draggedTaskId = useLinearStore((s) => s.draggedTaskId)

  const [showNewWorktree, setShowNewWorktree] = useState(false)
  const [backHovered, setBackHovered] = useState(false)

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null
  const worktrees = workspace ? (worktreesByWorkspace[workspace.id] ?? []) : []

  const sorted = [...worktrees].sort((a, b) => {
    if (a.isMain && !b.isMain) return -1
    if (!a.isMain && b.isMain) return 1
    return 0
  })

  const generateRandomName = (): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let id = ''
    for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)]
    return `task-${id}`
  }

  const handleCreateWorktreeQuick = async (): Promise<void> => {
    if (!workspace) return
    const name = generateRandomName()
    try {
      await createWorktree(workspace.id, workspace.path, name, name)
    } catch {
      // ignore
    }
  }

  const handleCreateWorktree = async (branch: string): Promise<void> => {
    if (!workspace) return
    setShowNewWorktree(false)
    try {
      await createWorktree(workspace.id, workspace.path, branch, branch)
    } catch {
      // ignore
    }
  }

  const handleRemoveWorktree = async (worktreePath: string): Promise<void> => {
    if (!workspace) return
    await removeWorktree(workspace.id, workspace.path, worktreePath)
  }

  const handleDropLinearTask = async (taskData: {
    id: string
    identifier: string
    title: string
    branchName: string
  }): Promise<void> => {
    if (!workspace) return
    setDraggedTask(null)
    try {
      // Fetch branch name from Linear if not provided
      let branch = taskData.branchName
      if (!branch) {
        const result = (await window.api.invoke('linear:getBranchName', { taskId: taskData.id })) as { branchName: string }
        branch = result.branchName
      }
      const name = `${taskData.identifier}: ${taskData.title}`.slice(0, 60)
      const wt = await createWorktree(workspace.id, workspace.path, branch, name)
      await linkWorktree(wt.path, taskData.id, taskData.identifier)
    } catch {
      // If branch exists, the user can create it manually
    }
  }

  const handleRenameWorktree = async (wt: Worktree, newName: string): Promise<void> => {
    if (!workspace) return
    const oldBranch = wt.branch || wt.name
    if (oldBranch === newName) return
    try {
      await window.api.invoke('git:renameBranch', {
        worktreePath: wt.path,
        oldName: oldBranch,
        newName,
      })
      // Reload worktrees to reflect the change
      await loadWorktrees(workspace.id, workspace.path)
    } catch {
      // ignore rename errors
    }
  }

  if (!workspace) return <div />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Back button + workspace name header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px 6px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          onMouseEnter={() => setBackHovered(true)}
          onMouseLeave={() => setBackHovered(false)}
          title="Back to workspaces"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: backHovered ? 'var(--text2)' : 'var(--text3)',
            fontSize: 12,
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: 4,
            transition: 'color .12s',
            flexShrink: 0,
          }}
        >
          ←
        </button>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {workspace.name}
        </span>
      </div>

      {/* Worktree list — fixed min height prevents layout jump on load */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 120 }}>
        <div
          style={{
            padding: '8px 14px 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
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
            Worktrees
          </span>
          <button
            onClick={handleCreateWorktreeQuick}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text3)',
              fontSize: 18,
              lineHeight: 1,
              padding: '0 2px',
              transition: 'color .12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
            title="Quick-create worktree"
          >
            +
          </button>
        </div>

        {sorted.map((wt) => {
          const isActive = wt.isMain
            ? activeWorktreeId === null
            : activeWorktreeId === wt.id
          return (
            <WorktreeNode
              key={wt.id}
              worktree={wt}
              isActive={isActive}
              onSelect={() => setActiveWorktree(wt.isMain ? null : wt.id)}
              onRemove={() => handleRemoveWorktree(wt.path)}
              onRename={(newName) => handleRenameWorktree(wt, newName)}
            />
          )
        })}

        {showNewWorktree && (
          <NewWorktreeInline
            onSubmit={handleCreateWorktree}
            onCancel={() => setShowNewWorktree(false)}
          />
        )}
        {!showNewWorktree && sorted.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, paddingRight: 8, height: 24 }}>
            <div
              onClick={handleCreateWorktreeQuick}
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', opacity: 0.5, transition: 'opacity .12s' }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5' }}
            >
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>+</span>
              <span style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.04em' }}>Quick worktree</span>
            </div>
            <button
              onClick={() => setShowNewWorktree(true)}
              title="Custom branch name"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text3)',
                fontSize: 10,
                padding: '0 2px',
                transition: 'color .12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
            >
              ✎
            </button>
          </div>
        )}

        {worktrees.length === 0 && (
          <p
            style={{
              fontSize: 10,
              color: 'var(--text3)',
              padding: '8px 14px',
              lineHeight: 1.6,
            }}
          >
            No worktrees found
          </p>
        )}

        {/* Drop zone for Linear tasks — only visible while dragging */}
        {draggedTaskId && <WorktreeDropZone onDrop={handleDropLinearTask} />}

        {/* Linear integration section */}
        <LinearSection />
      </div>
    </div>
  )
}

// ── Explorer view ─────────────────────────────────────────────────────────────

function ExplorerView({ onAddWorkspace }: { onAddWorkspace: () => void }): JSX.Element {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)

  const handleBack = (): void => {
    setActiveWorkspace(null)
  }

  if (activeWorkspaceId) {
    return <ActiveWorkspaceView onBack={handleBack} />
  }

  return <WorkspaceSelector onAddWorkspace={onAddWorkspace} />
}

// ── Settings view ─────────────────────────────────────────────────────────────

function SettingsView(): JSX.Element {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const worktreesByWorkspace = useWorkspaceStore((s) => s.worktreesByWorkspace)

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null

  const [claudeMd, setClaudeMd] = useState<string>('')
  const [claudeMdLoading, setClaudeMdLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [gitBranch, setGitBranch] = useState<string | null>(null)

  const worktreeCount = workspace
    ? (worktreesByWorkspace[workspace.id] ?? []).length
    : 0

  // Load CLAUDE.md and git branch whenever the active workspace changes
  useEffect(() => {
    if (!workspace) return

    setClaudeMdLoading(true)
    setGitBranch(null)

    window.api.invoke('workspace:readClaudeMd', { path: workspace.path })
      .then((content) => {
        setClaudeMd((content as string | null) ?? '')
      })
      .catch(() => setClaudeMd(''))
      .finally(() => setClaudeMdLoading(false))

    window.api.invoke('git:branch', { path: workspace.path })
      .then((branch) => setGitBranch(branch as string | null))
      .catch(() => setGitBranch(null))
  }, [workspace?.id])

  const handleSave = async (): Promise<void> => {
    if (!workspace) return
    setSaving(true)
    setSaveMsg(null)
    try {
      await window.api.invoke('workspace:writeClaudeMd', { path: workspace.path, content: claudeMd })
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(null), 2000)
    } catch {
      setSaveMsg('Error saving')
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async (): Promise<void> => {
    if (!workspace) return
    setRegenerating(true)
    setSaveMsg(null)
    try {
      const info = await window.api.invoke('workspace:getProjectInfo', { path: workspace.path }) as {
        name: string
        description: string
        techStack: string[]
        buildCommands: string[]
      } | null
      if (info) {
        const techList = info.techStack.map((t: string) => `- ${t}`).join('\n')
        const cmdList = info.buildCommands.length > 0
          ? info.buildCommands.map((c: string) => `- \`${c}\``).join('\n')
          : '- (no build commands detected)'
        const generated = `# ${info.name}\n\n## Project Overview\n${info.description}\n\n## Tech Stack\n${techList}\n\n## Development\n${cmdList}\n\n## Guidelines\n- Follow existing code patterns\n- Write tests for new functionality\n- Keep commits atomic\n`
        setClaudeMd(generated)
        await window.api.invoke('workspace:writeClaudeMd', { path: workspace.path, content: generated })
        setSaveMsg('Regenerated')
        setTimeout(() => setSaveMsg(null), 2000)
      }
    } catch {
      setSaveMsg('Error regenerating')
    } finally {
      setRegenerating(false)
    }
  }

  if (!workspace) {
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
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
          No workspace selected
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: '12px 0',
      }}
    >
      {/* Section: Workspace Info */}
      <div style={{ padding: '0 14px 12px' }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'var(--text3)',
            textTransform: 'uppercase',
          }}
        >
          Workspace
        </span>
      </div>

      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.06em' }}>
            NAME
          </label>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text)',
              padding: '5px 8px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              fontFamily: 'var(--mono)',
            }}
          >
            {workspace.name}
          </div>
        </div>

        {/* Path */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.06em' }}>
            PATH
          </label>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text2)',
              padding: '5px 8px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              fontFamily: 'var(--mono)',
              overflowX: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={workspace.path}
          >
            {workspace.path}
          </div>
        </div>

        {/* Git branch + worktree count */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.06em' }}>
              BRANCH
            </label>
            <div
              style={{
                fontSize: 11,
                color: gitBranch ? 'var(--green)' : 'var(--text3)',
                padding: '4px 8px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                fontFamily: 'var(--mono)',
              }}
            >
              {gitBranch ?? '—'}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.06em' }}>
              WORKTREES
            </label>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text2)',
                padding: '4px 8px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                fontFamily: 'var(--mono)',
              }}
            >
              {worktreeCount || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

      {/* Section: CLAUDE.md */}
      <div style={{ padding: '0 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'var(--text3)',
            textTransform: 'uppercase',
          }}
        >
          CLAUDE.md
        </span>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          style={{
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent)',
            borderRadius: 4,
            color: 'var(--accent2)',
            fontSize: 10,
            padding: '2px 8px',
            cursor: regenerating ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--mono)',
            opacity: regenerating ? 0.6 : 1,
            transition: 'opacity .12s',
          }}
        >
          {regenerating ? '...' : 'Regenerate'}
        </button>
      </div>

      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {claudeMdLoading ? (
          <div style={{ fontSize: 11, color: 'var(--text3)', padding: '8px 0' }}>Loading...</div>
        ) : (
          <textarea
            value={claudeMd}
            onChange={(e) => setClaudeMd(e.target.value)}
            placeholder="No CLAUDE.md found. Click Regenerate to create one."
            style={{
              width: '100%',
              minHeight: 220,
              resize: 'vertical',
              fontSize: 10,
              lineHeight: 1.6,
              padding: '8px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text)',
              fontFamily: 'var(--mono)',
            }}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          {saveMsg && (
            <span style={{ fontSize: 10, color: saveMsg.startsWith('Error') ? 'var(--red)' : 'var(--green)' }}>
              {saveMsg}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || claudeMdLoading}
            style={{
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              fontSize: 10,
              padding: '4px 12px',
              cursor: saving || claudeMdLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--mono)',
              opacity: saving || claudeMdLoading ? 0.6 : 1,
              transition: 'opacity .12s',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SidebarContent export (workspace list / settings panel, no activity bar) ──

export function SidebarContent(): JSX.Element {
  const activeView = useSidebarStore((s) => s.activeView)
  const addWorkspace = useWorkspaceStore((s) => s.addWorkspace)

  const handleAddWorkspace = async (): Promise<void> => {
    const result = await window.api.invoke('dialog:openDirectory', undefined)
    const path = result as string | null
    if (path) {
      await addWorkspace(path)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        overflow: 'hidden',
        height: '100%',
        width: '100%',
      }}
    >
      {activeView === 'explorer' && <ExplorerView onAddWorkspace={handleAddWorkspace} />}
      {activeView === 'settings' && <SettingsView />}
    </div>
  )
}
