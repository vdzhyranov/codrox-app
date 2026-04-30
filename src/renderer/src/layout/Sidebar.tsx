import { useState, useEffect, useRef } from 'react'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import { useSidebarStore } from '@renderer/store/sidebarStore'
import { useLinearStore } from '@renderer/store/linearStore'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { useWorkspaceSettingsStore } from '@renderer/store/workspaceSettingsStore'
import { CreateTaskModal } from '@renderer/components/CreateTaskModal'
import { LinearSetupModal } from '@renderer/components/LinearSetupModal'
import { WorkspaceSettingsModal } from '@renderer/components/WorkspaceSettingsModal'
import type { Workspace, Worktree, LinearTask } from '@shared/types'
import { THEMES } from '@shared/types'
import type { ThemeDefinition } from '@shared/types'

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

type SidebarView = 'explorer' | 'settings' | 'extensions'


// ── Activity Bar ──────────────────────────────────────────────────────────────

export function ActivityBar(): JSX.Element {
  const activeView = useSidebarStore((s) => s.activeView)
  const setActiveView = useSidebarStore((s) => s.setActiveView)
  const [hoveredId, setHoveredId] = useState<SidebarView | null>(null)
  const [versionInfo, setVersionInfo] = useState<{
    current: string
    latest: string | null
    updateAvailable: boolean
  } | null>(null)
  const [versionHovered, setVersionHovered] = useState(false)

  useEffect(() => {
    window.api.invoke('version:check').then((result) => {
      setVersionInfo(result as { current: string; latest: string | null; updateAvailable: boolean })
    })

    const unsub = window.api.on('version:update', (result) => {
      setVersionInfo(result as { current: string; latest: string | null; updateAvailable: boolean })
    })
    return unsub
  }, [])

  const items: { id: SidebarView; icon: string; label: string }[] = [
    { id: 'explorer', icon: '◈', label: 'Explorer' },
    { id: 'extensions', icon: '⧉', label: 'Extensions' },
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
                  fontSize: 'var(--fs-sm)',
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

      {/* Version badge at bottom */}
      <div style={{ marginTop: 'auto', paddingBottom: 10 }}>
        {versionInfo && (
          <div
            onMouseEnter={() => setVersionHovered(true)}
            onMouseLeave={() => setVersionHovered(false)}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              cursor: versionInfo.updateAvailable ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (versionInfo.updateAvailable) {
                window.api.invoke('shell:openExternal', { url: 'https://github.com/vdzhyranov/codrox-app/releases/latest' })
              }
            }}
          >
            {versionInfo.updateAvailable && (
              <div
                style={{
                  width: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              >
                📦
              </div>
            )}
            <div
              style={{
                fontSize: 9,
                fontFamily: 'var(--mono)',
                color: versionHovered ? 'var(--text2)' : 'var(--text3)',
                letterSpacing: '0.02em',
                transition: 'color .12s',
              }}
            >
              v{versionInfo.current}
            </div>

            {/* Tooltip */}
            {versionHovered && (
              <div
                style={{
                  position: 'absolute',
                  left: 46,
                  bottom: 0,
                  background: 'var(--surface3)',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  padding: '4px 8px',
                  fontSize: 10,
                  color: versionInfo.updateAvailable ? '#f59e0b' : 'var(--text2)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 100,
                  letterSpacing: '0.06em',
                }}
              >
                {versionInfo.updateAvailable
                  ? `Update available: v${versionInfo.latest}`
                  : 'Up to date'}
              </div>
            )}
          </div>
        )}
      </div>
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
          fontSize: 'var(--fs-xs)',
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
          fontSize: 'var(--fs-md)',
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
          fontSize: 'var(--fs-icon)',
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
            fontSize: 'var(--fs-md)',
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
          fontSize: 'var(--fs-md)',
          color: isActive ? 'var(--text)' : 'var(--text2)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {worktree.branch || worktree.name}
      </span>
      {/* active Claude session indicator */}
      {worktree.hasActiveSession && (
        <span
          title="Claude session active"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--green, #3fb950)',
            flexShrink: 0,
            boxShadow: '0 0 4px var(--green, #3fb950)',
          }}
        />
      )}
      {/* external worktree badge */}
      {worktree.isExternal && !worktree.isMain && (
        <span
          title="Created outside Codrox"
          style={{
            fontSize: 8,
            color: 'var(--text3)',
            background: 'var(--surface2)',
            border: '1px solid var(--border, rgba(255,255,255,.1))',
            borderRadius: 3,
            padding: '0 4px',
            fontFamily: 'var(--mono)',
            flexShrink: 0,
            lineHeight: '14px',
            letterSpacing: '0.04em',
          }}
        >
          ext
        </span>
      )}
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
            fontSize: 'var(--fs-icon)',
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
      <span style={{ fontSize: 'var(--fs-md)', color: 'var(--text3)' }}>+</span>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text3)', letterSpacing: '0.04em' }}>
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
            fontSize: 'var(--fs-icon)',
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
          fontSize: 'var(--fs-xs)',
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
              fontSize: 'var(--fs-xs)',
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
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)', marginLeft: 'auto' }}>
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
          fontSize: 'var(--fs-md)',
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
            fontSize: 'var(--fs-sm)',
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

// ── Module-level drag data (avoids HTML5 DnD entirely) ──────────────────────

let _linearDragData: { id: string; identifier: string; title: string; branchName: string } | null = null

// ── Linear task card (mouse-based drag) ─────────────────────────────────────

function LinearTaskCard({ task }: { task: LinearTask }): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const setDraggedTask = useLinearStore((s) => s.setDraggedTask)
  const draggedTaskId = useLinearStore((s) => s.draggedTaskId)
  const dragRef = useRef<{ startX: number; startY: number; active: boolean } | null>(null)

  const isDragging = draggedTaskId === task.id

  const priorityLabels: Record<number, { label: string; color: string }> = {
    1: { label: '!!!', color: 'var(--red)' },
    2: { label: '!!', color: '#f59e0b' },
    3: { label: '!', color: 'var(--accent2)' },
    4: { label: '~', color: 'var(--text3)' },
  }
  const prio = priorityLabels[task.priority]

  const handleMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, active: false }
    let ghost: HTMLDivElement | null = null

    const handleMouseMove = (me: MouseEvent): void => {
      if (!dragRef.current) return
      const dx = me.clientX - dragRef.current.startX
      const dy = me.clientY - dragRef.current.startY
      if (!dragRef.current.active && Math.abs(dx) + Math.abs(dy) > 5) {
        dragRef.current.active = true
        _linearDragData = {
          id: task.id,
          identifier: task.identifier,
          title: task.title,
          branchName: task.branchName,
        }
        setDraggedTask(task.id)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'

        // Create floating ghost
        ghost = document.createElement('div')
        ghost.textContent = `${task.identifier}  ${task.title}`
        ghost.style.cssText = `
          position:fixed;pointer-events:none;z-index:9999;
          padding:6px 10px;border-radius:6px;font-size:11px;
          font-family:var(--mono);color:var(--text);max-width:220px;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          background:var(--surface3);border:1px solid var(--accent);
          box-shadow:0 4px 12px rgba(0,0,0,.4);opacity:0.9;
        `
        document.body.appendChild(ghost)
      }
      if (ghost) {
        ghost.style.left = `${me.clientX + 12}px`
        ghost.style.top = `${me.clientY + 12}px`
      }
    }

    const handleMouseUp = (): void => {
      if (ghost) {
        ghost.remove()
        ghost = null
      }
      if (dragRef.current?.active) {
        setDraggedTask(null)
        _linearDragData = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      dragRef.current = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 10px',
        margin: '0 8px 4px',
        borderRadius: 6,
        border: hovered ? '1px solid var(--border2)' : '1px solid var(--border)',
        background: hovered ? 'var(--surface2)' : 'var(--surface)',
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: 'border-color .12s, background .12s',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: task.state.color || 'var(--text3)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text3)',
            fontFamily: 'var(--mono)',
            flexShrink: 0,
          }}
        >
          {task.identifier}
        </span>
        {prio && (
          <span style={{ fontSize: 'var(--fs-xs)', color: prio.color, fontFamily: 'var(--mono)', marginLeft: 'auto' }}>
            {prio.label}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 'var(--fs-md)',
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

// ── Worktree drop zone (for Linear tasks — mouse-based) ─────────────────────

function WorktreeDropZone({
  onDrop,
}: {
  onDrop: (taskData: { id: string; identifier: string; title: string; branchName: string }) => void
}): JSX.Element {
  const [hover, setHover] = useState(false)

  const handleMouseUp = (): void => {
    if (_linearDragData) {
      onDrop({ ..._linearDragData })
    }
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseUp={handleMouseUp}
      style={{
        margin: '4px 8px',
        padding: hover ? '14px 10px' : '6px 10px',
        borderRadius: 6,
        border: hover
          ? '2px solid var(--accent)'
          : '2px dashed rgba(124,106,247,.2)',
        background: hover
          ? 'rgba(124,106,247,.12)'
          : 'rgba(124,106,247,.02)',
        textAlign: 'center',
        transition: 'all .15s',
        minHeight: 16,
      }}
    >
      <span style={{
        fontSize: 'var(--fs-sm)',
        color: hover ? 'var(--accent2)' : 'var(--text3)',
        opacity: hover ? 1 : 0.6,
      }}>
        {hover ? 'Release to create worktree' : 'Drop task to create worktree'}
      </span>
    </div>
  )
}

// ── GitHub Issues section (stub — integration coming soon) ───────────────────

function GitHubIssuesSection(): JSX.Element {
  return (
    <>
      <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
      <div style={{ padding: '8px 14px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>⬡</span>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text3)', textTransform: 'uppercase' }}>
          GitHub Issues
        </span>
      </div>
      <div style={{ padding: '4px 14px 8px' }}>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text3)', lineHeight: 1.5 }}>
          GitHub Issues integration coming soon.
        </span>
      </div>
    </>
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
  const checkAuth = useLinearStore((s) => s.checkAuth)
  const fetchTasks = useLinearStore((s) => s.fetchTasks)
  const setSelectedTeam = useLinearStore((s) => s.setSelectedTeam)
  const setActiveView = useSidebarStore((s) => s.setActiveView)

  const [collapsed, setCollapsed] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const timeSince = lastFetched
    ? `${Math.round((Date.now() - lastFetched) / 60000)}m ago`
    : null

  if (!isAuthenticated) return <></>

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
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)', transition: 'transform .12s', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
            ▾
          </span>
          <span
            style={{
              fontSize: 'var(--fs-xs)',
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
                fontSize: 'var(--fs-md)',
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
            <div style={{ padding: '8px 14px' }}>
              <span
                onClick={() => setActiveView('extensions')}
                style={{
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--accent2)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationColor: 'transparent',
                  transition: 'text-decoration-color .12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.textDecorationColor = 'var(--accent2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.textDecorationColor = 'transparent' }}
              >
                Connect in Extensions
              </span>
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
                      fontSize: 'var(--fs-sm)',
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
                <div style={{ padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text3)' }}>
                  Loading tasks...
                </div>
              ) : error ? (
                <div style={{ padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--red)' }}>
                  {error}
                </div>
              ) : tasks.length === 0 ? (
                <div style={{ padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text3)' }}>
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
                <div style={{ padding: '4px 14px', fontSize: 'var(--fs-xs)', color: 'var(--text3)', textAlign: 'right' }}>
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

  const loadWsSettings = useWorkspaceSettingsStore((s) => s.loadSettings)
  const wsSettings = useWorkspaceSettingsStore((s) => activeWorkspaceId ? s.getSettings(activeWorkspaceId) : null)

  const linkWorktree = useLinearStore((s) => s.linkWorktree)
  const setDraggedTask = useLinearStore((s) => s.setDraggedTask)
  const draggedTaskId = useLinearStore((s) => s.draggedTaskId)

  const [showNewWorktree, setShowNewWorktree] = useState(false)
  const [backHovered, setBackHovered] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [defaultBranch, setDefaultBranch] = useState<string | null>(null)
  const [remoteBranches, setRemoteBranches] = useState<string[]>([])
  const [showBranchSelector, setShowBranchSelector] = useState(false)

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null

  // Load workspace settings and remote branches on workspace change
  useEffect(() => {
    if (!workspace) return
    loadWsSettings(workspace.id)
      .then((s) => setDefaultBranch(s.git.mainBranch))
      .catch(() => {})
    window.api.invoke('workspace:listRemoteBranches', { workspacePath: workspace.path })
      .then((branches) => setRemoteBranches(branches as string[]))
      .catch(() => {})
  }, [workspace?.id, workspace?.path])

  const handleSetDefaultBranch = async (branch: string): Promise<void> => {
    if (!workspace) return
    const resolved = branch || null
    setDefaultBranch(resolved)
    setShowBranchSelector(false)
    await window.api.invoke('workspace:setDefaultBranch', { workspaceId: workspace.id, branch }).catch(() => {})
    // Reload settings so the modal stays in sync
    loadWsSettings(workspace.id).catch(() => {})
  }

  // Subscribe to git-metadata changes so branch renames and external worktree
  // mutations are reflected immediately without a manual refresh.
  useEffect(() => {
    if (!workspace) return

    window.api.invoke('worktree:watch', {
      workspaceId: workspace.id,
      workspacePath: workspace.path,
    }).catch(() => {})

    const unsub = window.api.on('worktree:changed', (payload) => {
      const { workspaceId } = payload as { workspaceId: string }
      if (workspaceId === workspace.id) {
        loadWorktrees(workspace.id, workspace.path).catch(() => {})
      }
    })

    return () => {
      unsub()
      window.api.invoke('worktree:unwatch', { workspaceId: workspace.id }).catch(() => {})
    }
  }, [workspace?.id, workspace?.path])
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
      await createWorktree(workspace.id, workspace.path, name, name, defaultBranch ?? undefined)
    } catch {
      // ignore
    }
  }

  const handleCreateWorktree = async (branch: string): Promise<void> => {
    if (!workspace) return
    setShowNewWorktree(false)
    try {
      await createWorktree(workspace.id, workspace.path, branch, branch, defaultBranch ?? undefined)
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
      const wt = await createWorktree(workspace.id, workspace.path, branch, name, defaultBranch ?? undefined)
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
            fontSize: 'var(--fs-icon)',
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
            fontSize: 'var(--fs-icon)',
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
        <button
          onClick={() => setShowSettingsModal(true)}
          title="Workspace settings"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text3)',
            fontSize: 13,
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: 4,
            transition: 'color .12s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
        >
          ⚙
        </button>
      </div>

      {showSettingsModal && (
        <WorkspaceSettingsModal
          workspaceId={workspace.id}
          workspacePath={workspace.path}
          onClose={() => {
            setShowSettingsModal(false)
            // Sync defaultBranch after settings save
            loadWsSettings(workspace.id)
              .then((s) => setDefaultBranch(s.git.mainBranch))
              .catch(() => {})
          }}
        />
      )}

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
              fontSize: 'var(--fs-xs)',
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

        {/* Default base branch selector */}
        <div style={{ position: 'relative', padding: '0 14px 4px' }}>
          <button
            onClick={() => setShowBranchSelector((v) => !v)}
            title="Set default base branch for new worktrees"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              padding: 0,
              color: 'var(--text3)',
            }}
          >
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>base:</span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>
              {defaultBranch || 'auto'}
            </span>
            <span style={{ fontSize: 9, color: 'var(--text3)', lineHeight: 1 }}>▾</span>
          </button>
          {showBranchSelector && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 14,
                zIndex: 100,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                minWidth: 140,
                maxHeight: 200,
                overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <div
                onClick={() => handleSetDefaultBranch('')}
                style={{
                  padding: '5px 10px',
                  fontSize: 'var(--fs-sm)',
                  color: !defaultBranch ? 'var(--accent2)' : 'var(--text2)',
                  cursor: 'pointer',
                  fontStyle: 'italic',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface3)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                auto (origin/HEAD)
              </div>
              {remoteBranches.map((b) => (
                <div
                  key={b}
                  onClick={() => handleSetDefaultBranch(b)}
                  style={{
                    padding: '5px 10px',
                    fontSize: 'var(--fs-sm)',
                    fontFamily: 'var(--mono)',
                    color: defaultBranch === b ? 'var(--accent2)' : 'var(--text)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface3)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  {b}
                </div>
              ))}
            </div>
          )}
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
              <span style={{ fontSize: 'var(--fs-md)', color: 'var(--text3)' }}>+</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text3)', letterSpacing: '0.04em' }}>Quick worktree</span>
            </div>
            <button
              onClick={() => setShowNewWorktree(true)}
              title="Custom branch name"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text3)',
                fontSize: 'var(--fs-sm)',
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
              fontSize: 'var(--fs-sm)',
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

        {/* Issue tracker integration section */}
        {wsSettings?.integrations.issueTracker === 'linear' && <LinearSection />}
        {wsSettings?.integrations.issueTracker === 'github' && <GitHubIssuesSection />}
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

// ── Theme swatch ──────────────────────────────────────────────────────────────

function ThemeSwatch({
  theme,
  isActive,
  onClick,
}: {
  theme: ThemeDefinition
  isActive: boolean
  onClick: () => void
}): JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: theme.colors.surface,
        border: isActive
          ? `2px solid ${theme.colors.accent}`
          : `1px solid ${hovered ? theme.colors.border2 : theme.colors.border}`,
        borderRadius: 8,
        padding: isActive ? 9 : 10,
        cursor: 'pointer',
        transition: 'border-color .15s',
      }}
    >
      {/* Mini preview */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: theme.colors.accent,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              flex: 1,
              height: 2,
              borderRadius: 1,
              background: theme.colors.text,
              opacity: 0.5,
            }}
          />
        </div>
        <div
          style={{
            height: 2,
            borderRadius: 1,
            background: theme.colors.text2,
            opacity: 0.4,
            width: '75%',
            marginBottom: 3,
          }}
        />
        <div
          style={{
            height: 2,
            borderRadius: 1,
            background: theme.colors.text3,
            opacity: 0.4,
            width: '50%',
          }}
        />
      </div>
      <div
        style={{
          fontSize: 'var(--fs-xs)',
          color: isActive ? theme.colors.accent2 : theme.colors.text2,
          fontFamily: 'var(--mono)',
          letterSpacing: '0.04em',
        }}
      >
        {theme.name}
      </div>
    </div>
  )
}

// ── Settings view ─────────────────────────────────────────────────────────────

function SettingsView(): JSX.Element {
  const currentTheme = useSettingsStore((s) => s.theme)
  const fontSize = useSettingsStore((s) => s.fontSize)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const setFontSize = useSettingsStore((s) => s.setFontSize)

  const isMac = navigator.platform.includes('Mac')
  const modKey = isMac ? '\u2318' : 'Ctrl'

  const fontSizePresets = [
    { label: 'S', value: 11 },
    { label: 'M', value: 13 },
    { label: 'L', value: 15 },
    { label: 'XL', value: 17 },
  ]

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
      {/* Section: Theme */}
      <div style={{ padding: '0 14px 8px' }}>
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'var(--text3)',
            textTransform: 'uppercase',
          }}
        >
          Theme
        </span>
      </div>

      <div style={{ padding: '0 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {THEMES.map((t) => (
            <ThemeSwatch
              key={t.id}
              theme={t}
              isActive={currentTheme === t.id}
              onClick={() => setTheme(t.id)}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

      {/* Section: Font Size */}
      <div style={{ padding: '0 14px 8px' }}>
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'var(--text3)',
            textTransform: 'uppercase',
          }}
        >
          Font Size
        </span>
      </div>

      <div style={{ padding: '0 14px' }}>
        {/* Preset buttons */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {fontSizePresets.map((preset) => {
            const isActive = fontSize === preset.value
            return (
              <button
                key={preset.value}
                onClick={() => setFontSize(preset.value)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  borderRadius: 6,
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: isActive ? 'var(--accent-dim)' : 'var(--surface2)',
                  color: isActive ? 'var(--accent2)' : 'var(--text2)',
                  fontSize: 'var(--fs-sm)',
                  fontFamily: 'var(--mono)',
                  cursor: 'pointer',
                  transition: 'all .12s',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        {/* Fine-tune control */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '5px 10px',
          }}
        >
          <button
            onClick={() => setFontSize(fontSize - 1)}
            disabled={fontSize <= 11}
            style={{
              background: 'none',
              border: 'none',
              cursor: fontSize <= 11 ? 'not-allowed' : 'pointer',
              color: fontSize <= 11 ? 'var(--text3)' : 'var(--text2)',
              fontSize: 14,
              fontFamily: 'var(--mono)',
              padding: '0 4px',
              lineHeight: 1,
              opacity: fontSize <= 11 ? 0.3 : 1,
            }}
          >
            {'\u2212'}
          </button>
          <span
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 'var(--fs-md)',
              color: 'var(--text)',
              fontFamily: 'var(--mono)',
              fontWeight: 500,
            }}
          >
            {fontSize}px
          </span>
          <button
            onClick={() => setFontSize(fontSize + 1)}
            disabled={fontSize >= 18}
            style={{
              background: 'none',
              border: 'none',
              cursor: fontSize >= 18 ? 'not-allowed' : 'pointer',
              color: fontSize >= 18 ? 'var(--text3)' : 'var(--text2)',
              fontSize: 14,
              fontFamily: 'var(--mono)',
              padding: '0 4px',
              lineHeight: 1,
              opacity: fontSize >= 18 ? 0.3 : 1,
            }}
          >
            +
          </button>
        </div>

        {fontSize !== 13 && (
          <button
            onClick={() => setFontSize(13)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--accent2)',
              fontSize: 'var(--fs-xs)',
              fontFamily: 'var(--mono)',
              padding: '4px 0',
              letterSpacing: '0.04em',
            }}
          >
            Reset to default (13px)
          </button>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

      {/* Section: Keyboard Shortcuts */}
      <div style={{ padding: '0 14px 8px' }}>
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'var(--text3)',
            textTransform: 'uppercase',
          }}
        >
          Shortcuts
        </span>
      </div>

      <div style={{ padding: '0 14px' }}>
        {[
          { label: 'Zoom In', keys: `${modKey} =` },
          { label: 'Zoom Out', keys: `${modKey} -` },
          { label: 'Reset Zoom', keys: `${modKey} 0` },
          { label: 'Close Tab', keys: `${modKey} W` },
        ].map((shortcut) => (
          <div
            key={shortcut.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text2)' }}>{shortcut.label}</span>
            <span
              style={{
                fontSize: 'var(--fs-xs)',
                color: 'var(--text3)',
                fontFamily: 'var(--mono)',
                background: 'var(--surface2)',
                padding: '2px 6px',
                borderRadius: 3,
                border: '1px solid var(--border)',
              }}
            >
              {shortcut.keys}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Extensions view ──────────────────────────────────────────────────────────

function ExtensionsView(): JSX.Element {
  const isAuthenticated = useLinearStore((s) => s.isAuthenticated)
  const user = useLinearStore((s) => s.user)
  const checkAuth = useLinearStore((s) => s.checkAuth)
  const disconnect = useLinearStore((s) => s.disconnect)

  const [showSetupModal, setShowSetupModal] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

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
      {/* Header */}
      <div style={{ padding: '0 14px 12px' }}>
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'var(--text3)',
            textTransform: 'uppercase',
          }}
        >
          Extensions
        </span>
      </div>

      {/* Linear card */}
      <div
        style={{
          margin: '0 14px',
          padding: 12,
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>◫</span>
            <div>
              <div style={{ fontSize: 'var(--fs-icon)', fontWeight: 600, color: 'var(--text)' }}>Linear</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>Issue tracking</div>
            </div>
          </div>
          {isAuthenticated && (
            <span
              style={{
                fontSize: 8,
                color: 'var(--green)',
                background: 'rgba(62,207,142,.12)',
                padding: '2px 6px',
                borderRadius: 3,
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              Connected
            </span>
          )}
        </div>

        {isAuthenticated ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text2)' }}>
              Signed in as {user?.displayName || user?.name || user?.email}
            </span>
            <button
              onClick={() => disconnect()}
              style={{
                width: '100%',
                padding: '5px 12px',
                fontSize: 'var(--fs-sm)',
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 5,
                color: 'var(--text3)',
                cursor: 'pointer',
                fontFamily: 'var(--mono)',
                transition: 'all .12s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--red)'
                e.currentTarget.style.color = 'var(--red)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text3)'
              }}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSetupModal(true)}
            style={{
              width: '100%',
              padding: '6px 12px',
              fontSize: 'var(--fs-md)',
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent)',
              borderRadius: 5,
              color: 'var(--accent2)',
              cursor: 'pointer',
              fontFamily: 'var(--mono)',
              transition: 'all .12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent-dim)'
              e.currentTarget.style.color = 'var(--accent2)'
            }}
          >
            Connect
          </button>
        )}
      </div>

      {showSetupModal && (
        <LinearSetupModal onClose={() => setShowSetupModal(false)} />
      )}
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
      {activeView === 'extensions' && <ExtensionsView />}
      {activeView === 'settings' && <SettingsView />}
    </div>
  )
}
