import { useEffect, useCallback, useState } from 'react'
import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'

interface AgentEntry {
  id: string
  task: string
  status: 'running' | 'completed'
  startedAt: number
}

const TYPE_COLORS: Record<string, string> = {
  architect: 'var(--accent2)',
  security: 'var(--amber)',
  qa: 'var(--green)',
  analyst: 'var(--blue)',
  reviewer: 'var(--pink)',
  executor: 'var(--green)',
  explore: 'var(--blue)',
  writer: 'var(--text2)',
  default: 'var(--text3)',
}

function guessType(task: string): string {
  const lower = task.toLowerCase()
  for (const key of Object.keys(TYPE_COLORS)) {
    if (key !== 'default' && lower.includes(key)) return key
  }
  if (lower.includes('review')) return 'reviewer'
  if (lower.includes('test')) return 'qa'
  if (lower.includes('search') || lower.includes('find') || lower.includes('explore')) return 'explore'
  if (lower.includes('build') || lower.includes('implement')) return 'executor'
  return 'default'
}

function getColor(task: string): string {
  return TYPE_COLORS[guessType(task)] ?? TYPE_COLORS.default
}

function formatAge(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h`
}

export function AgentList(): JSX.Element {
  const activeWorktreePath = useActiveWorktreePath()
  const [agents, setAgents] = useState<AgentEntry[]>([])

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

  if (agents.length === 0) {
    return (
      <div style={{ padding: '6px 12px', fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>
        No recent agents
      </div>
    )
  }

  // Running first, then completed — all visible, no toggle
  const running = agents.filter((a) => a.status === 'running')
  const completed = agents.filter((a) => a.status === 'completed')

  return (
    <div style={{ padding: '4px 8px' }}>
      {running.map((a) => (
        <AgentItem key={a.id} agent={a} onOpen={() => handleOpen(a)} />
      ))}
      {running.length > 0 && completed.length > 0 && (
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
      )}
      {completed.map((a) => (
        <AgentItem key={a.id} agent={a} onOpen={() => handleOpen(a)} />
      ))}
    </div>
  )
}

function AgentItem({ agent, onOpen }: { agent: AgentEntry; onOpen: () => void }): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const isRunning = agent.status === 'running'
  const color = getColor(agent.task)

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
        background: isRunning
          ? hovered ? 'var(--accent-dim)' : 'rgba(124, 106, 247, 0.06)'
          : hovered ? 'var(--surface2)' : 'transparent',
        border: isRunning ? '1px solid rgba(124, 106, 247, 0.2)' : '1px solid transparent',
        transition: 'all .1s',
        marginBottom: 2,
      }}
    >
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: isRunning ? 'var(--amber)' : 'var(--text3)',
          flexShrink: 0,
          boxShadow: isRunning ? '0 0 4px var(--amber)' : 'none',
        }}
        className={isRunning ? 'pulse' : undefined}
      />
      <span
        style={{
          fontSize: 'var(--fs-sm)',
          color: isRunning ? 'var(--text)' : 'var(--text3)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          fontWeight: isRunning ? 500 : 400,
        }}
      >
        {agent.task || agent.id.slice(0, 8)}
      </span>
      <span style={{ fontSize: 'var(--fs-xs)', color: isRunning ? color : 'var(--text3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
        {formatAge(agent.startedAt)}
      </span>
    </div>
  )
}
