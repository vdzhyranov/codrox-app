import { useEffect, useCallback, useState } from 'react'
import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'

interface AgentEntry {
  id: string
  task: string
  status: 'running' | 'completed'
  startedAt: number
}

const GREEK = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω']
const BADGE_COLORS = ['#7c6af7', '#60a5fa', '#f59e0b', '#3ecf8e', '#f472b6']

function formatRuntime(startedAt: number): string {
  const secs = Math.floor((Date.now() - startedAt) / 1000)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function AgentList(): JSX.Element {
  const activeWorktreePath = useActiveWorktreePath()
  const [agents, setAgents] = useState<AgentEntry[]>([])
  const [showCompleted, setShowCompleted] = useState(false)

  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const worktreesByWorkspace = useWorkspaceStore((s) => s.worktreesByWorkspace)
  const activeWorktreeId = useWorkspaceStore((s) => s.activeWorktreeId)

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)
  const worktrees = activeWorkspace ? (worktreesByWorkspace[activeWorkspace.id] ?? []) : []
  const activeWorktree = worktrees.find((w) => w.id === activeWorktreeId)
  const branch = activeWorktree?.branch ?? activeWorktreePath?.split('/').pop() ?? ''

  const refresh = useCallback(async () => {
    if (!activeWorktreePath) { setAgents([]); return }
    try {
      const result = (await window.api.invoke('agents:list', {
        workspacePath: activeWorktreePath,
      })) as AgentEntry[]
      setAgents(result)
    } catch {
      setAgents([])
    }
  }, [activeWorktreePath])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleOpen = (agent: AgentEntry): void => {
    const tabKey = `agent-output:${agent.id}`
    const store = useFileTreeStore.getState()
    if (!store.openFiles.includes(tabKey)) {
      useFileTreeStore.setState({
        openFiles: [...store.openFiles, tabKey],
        activeTab: tabKey,
      })
    } else {
      store.setActiveTab(tabKey)
    }
  }

  const running = agents.filter((a) => a.status === 'running')
  const completed = agents.filter((a) => a.status === 'completed')

  if (agents.length === 0) {
    return (
      <div style={{ padding: '6px 12px', fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>
        No recent agents
      </div>
    )
  }

  return (
    <div style={{ padding: '8px' }}>
      {/* Full-height cards for running agents */}
      {running.map((agent, i) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          index={i}
          branch={branch}
          onOpen={() => handleOpen(agent)}
        />
      ))}

      {running.length === 0 && (
        <div style={{ padding: '2px 4px 6px', fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>
          No active agents
        </div>
      )}

      {/* Completed agents toggle + compact rows */}
      {completed.length > 0 && (
        <>
          <div
            onClick={() => setShowCompleted((s) => !s)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 4px',
              cursor: 'pointer',
              fontSize: 'var(--fs-xs)',
              color: 'var(--text3)',
              borderRadius: 4,
              transition: 'color .1s',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
          >
            <span>{showCompleted ? '▾' : '▸'} Completed</span>
            <span style={{
              padding: '0 4px',
              borderRadius: 3,
              background: 'var(--surface3)',
              border: '1px solid var(--border)',
              fontWeight: 600,
              fontFamily: 'var(--mono)',
            }}>
              {completed.length}
            </span>
          </div>
          {showCompleted && completed.map((a) => (
            <CompletedRow key={a.id} agent={a} onOpen={() => handleOpen(a)} />
          ))}
        </>
      )}
    </div>
  )
}

function AgentCard({
  agent,
  index,
  branch,
  onOpen,
}: {
  agent: AgentEntry
  index: number
  branch: string
  onOpen: () => void
}): JSX.Element {
  const [, forceUpdate] = useState(0)
  const greek = GREEK[index % GREEK.length]
  const color = BADGE_COLORS[index % BADGE_COLORS.length]

  useEffect(() => {
    const t = setInterval(() => forceUpdate((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div
      onClick={onOpen}
      style={{
        background: 'rgba(124, 106, 247, 0.06)',
        border: '1px solid rgba(124, 106, 247, 0.2)',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'background .15s, border-color .15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(124, 106, 247, 0.12)'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(124, 106, 247, 0.38)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(124, 106, 247, 0.06)'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(124, 106, 247, 0.2)'
      }}
    >
      {/* Header: Greek badge · branch · green pulse dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <div style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
          fontFamily: 'Georgia, "Times New Roman", serif',
          letterSpacing: 0,
        }}>
          {greek}
        </div>
        <span style={{
          flex: 1,
          fontSize: 'var(--fs-xs)',
          color: 'var(--text3)',
          fontFamily: 'var(--mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {branch}
        </span>
        <div
          className="pulse"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--green)',
            boxShadow: '0 0 5px var(--green)',
            flexShrink: 0,
          }}
        />
      </div>

      {/* Task description — 2 lines max */}
      <div style={{
        fontSize: 'var(--fs-sm)',
        color: 'var(--text)',
        fontWeight: 500,
        lineHeight: 1.45,
        marginBottom: 10,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {agent.task || agent.id.slice(0, 8)}
      </div>

      {/* Animated progress bar */}
      <div style={{
        height: 2,
        borderRadius: 1,
        background: 'var(--border)',
        overflow: 'hidden',
        marginBottom: 9,
        position: 'relative',
      }}>
        <div
          className="agent-shimmer"
          style={{
            position: 'absolute',
            top: 0,
            height: '100%',
            width: '45%',
            borderRadius: 1,
            background: `linear-gradient(90deg, transparent, ${color}cc, transparent)`,
          }}
        />
      </div>

      {/* Runtime clock */}
      <div style={{
        fontSize: 'var(--fs-xs)',
        color: 'var(--text3)',
        fontFamily: 'var(--mono)',
      }}>
        {formatRuntime(agent.startedAt)}
      </div>
    </div>
  )
}

function CompletedRow({ agent, onOpen }: { agent: AgentEntry; onOpen: () => void }): JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 6px',
        borderRadius: 4,
        cursor: 'pointer',
        background: hovered ? 'var(--surface2)' : 'transparent',
        marginBottom: 2,
        transition: 'background .1s',
      }}
    >
      <div style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: 'var(--text3)',
        flexShrink: 0,
        opacity: 0.5,
      }} />
      <span style={{
        fontSize: 'var(--fs-sm)',
        color: 'var(--text3)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
      }}>
        {agent.task || agent.id.slice(0, 8)}
      </span>
    </div>
  )
}
