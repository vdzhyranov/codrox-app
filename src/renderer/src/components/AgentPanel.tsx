import { useEffect, useState, useCallback } from 'react'
import { useAgentStore } from '@renderer/store/agentStore'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { TokenUsagePanel } from '@renderer/components/TokenUsagePanel'
import type { AgentInfo } from '@renderer/store/agentStore'

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  architect: { color: 'var(--accent2)', bg: 'var(--accent-dim)' },
  security: { color: 'var(--amber)', bg: 'var(--amber-dim)' },
  qa: { color: 'var(--green)', bg: 'var(--green-dim)' },
  analyst: { color: 'var(--blue)', bg: 'var(--blue-dim)' },
  reviewer: { color: 'var(--pink)', bg: 'var(--pink-dim)' },
  executor: { color: 'var(--green)', bg: 'var(--green-dim)' },
  explorer: { color: 'var(--blue)', bg: 'var(--blue-dim)' },
  default: { color: 'var(--text2)', bg: 'var(--surface3)' },
}

function getTypeStyle(type: string): { color: string; bg: string } {
  const key = type.toLowerCase().replace(/[-_\d]/g, '')
  for (const [k, v] of Object.entries(TYPE_COLORS)) {
    if (key.includes(k)) return v
  }
  return TYPE_COLORS.default
}

function AgentCard({
  agent,
  onOpen,
  onKill,
}: {
  agent: AgentInfo
  onOpen: () => void
  onKill: () => void
}): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const typeStyle = getTypeStyle(agent.type || agent.name)
  const isRunning = agent.status === 'running'

  const elapsed = agent.startedAt
    ? formatElapsed(new Date(agent.startedAt))
    : null

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        margin: '0 8px 4px',
        padding: '8px 10px',
        borderRadius: 6,
        border: hovered ? '1px solid var(--border2)' : '1px solid var(--border)',
        background: hovered ? 'var(--surface2)' : 'var(--surface)',
        cursor: 'pointer',
        transition: 'all .12s',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {/* Status dot */}
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isRunning ? 'var(--green)' : 'var(--text3)',
            flexShrink: 0,
            boxShadow: isRunning ? '0 0 4px var(--green)' : 'none',
          }}
          className={isRunning ? 'pulse' : undefined}
        />
        {/* Agent name */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {agent.name}
        </span>
        {/* Type badge */}
        <span
          style={{
            fontSize: 8,
            padding: '1px 5px',
            borderRadius: 3,
            background: typeStyle.bg,
            color: typeStyle.color,
            border: `1px solid ${typeStyle.color}33`,
            fontWeight: 600,
            fontFamily: 'var(--mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          {agent.type || '?'}
        </span>
      </div>

      {/* Task description */}
      {agent.task && (
        <div
          style={{
            fontSize: 9,
            color: 'var(--text3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: 3,
          }}
        >
          {agent.task}
        </div>
      )}

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 8,
            color: isRunning ? 'var(--green)' : 'var(--text3)',
            fontFamily: 'var(--mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {isRunning ? 'running' : agent.status}
        </span>
        {elapsed && (
          <span style={{ fontSize: 8, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            {elapsed}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onKill()
          }}
          title="Kill agent"
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text3)',
            fontSize: 10,
            padding: '0 2px',
            lineHeight: 1,
            opacity: hovered ? 1 : 0.3,
            transition: 'opacity .12s, color .12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

function formatElapsed(start: Date): string {
  const diff = Date.now() - start.getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

export function AgentPanel(): JSX.Element {
  const agents = useAgentStore((s) => s.agents)
  const setAgents = useAgentStore((s) => s.setAgents)
  const setActiveTab = useFileTreeStore((s) => s.setActiveTab)
  const activeWorktreePath = useActiveWorktreePath()
  const worktreeName = activeWorktreePath?.split('/').pop() ?? null

  const refreshAgents = useCallback(async () => {
    if (!activeWorktreePath) {
      setAgents([])
      return
    }

    try {
      // Use the workspace root path (not worktree path) for agent scanning
      const workspacePath = activeWorktreePath

      const entries = (await window.api.invoke('agents:list', { workspacePath })) as Array<{
        id: string
        task: string
        status: 'running' | 'completed'
        startedAt: number
        fileSize: number
      }>

      const agentInfos: AgentInfo[] = entries.map((e) => ({
        id: e.id,
        name: e.id.slice(0, 10),
        type: 'agent',
        task: e.task,
        status: e.status,
        sessionName: '',
        startedAt: new Date(e.startedAt).toISOString(),
      }))

      setAgents(agentInfos)
    } catch {
      setAgents([])
    }
  }, [setAgents, activeWorktreePath])

  // Poll for agents every 3 seconds
  useEffect(() => {
    refreshAgents()
    const interval = setInterval(refreshAgents, 3000)
    return () => clearInterval(interval)
  }, [refreshAgents])

  const handleOpenAgent = (agent: AgentInfo): void => {
    // Open as a special "agent:" tab in the main view
    const tabKey = `agent:${agent.sessionName}`
    // Use the file tree store's tab system with a special prefix
    const store = useFileTreeStore.getState()
    const alreadyOpen = store.openFiles.includes(tabKey)
    if (!alreadyOpen) {
      useFileTreeStore.setState({
        openFiles: [...store.openFiles, tabKey],
        activeTab: tabKey,
      })
    } else {
      store.setActiveTab(tabKey)
    }
  }

  const handleKillAgent = useCallback(async (agent: AgentInfo) => {
    // Close any open tab for this agent
    const store = useFileTreeStore.getState()
    const tabKey = `agent:${agent.sessionName}`
    if (store.openFiles.includes(tabKey)) {
      store.closeFile(tabKey)
    }
    const outputTabKey = `agent-output:${agent.id}`
    if (store.openFiles.includes(outputTabKey)) {
      store.closeFile(outputTabKey)
    }
    refreshAgents()
  }, [refreshAgents])

  const running = agents.filter((a) => a.status === 'running')
  const completed = agents.filter((a) => a.status !== 'running')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
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
          Agents
        </span>
        {worktreeName && (
          <span style={{ fontSize: 8, color: 'var(--text3)', fontFamily: 'var(--mono)', opacity: 0.6 }}>
            · {worktreeName}
          </span>
        )}
        <button
          onClick={refreshAgents}
          title="Refresh agents"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text3)',
            fontSize: 12,
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

      {/* Agent list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {agents.length === 0 ? (
          <div
            style={{
              padding: '20px 14px',
              fontSize: 10,
              color: 'var(--text3)',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            No agents detected.
            <br />
            Agents will appear here when running.
          </div>
        ) : (
          <>
            {running.length > 0 && (
              <>
                <div
                  style={{
                    padding: '6px 14px 4px',
                    fontSize: 8,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    color: 'var(--green)',
                    textTransform: 'uppercase',
                  }}
                >
                  Running ({running.length})
                </div>
                {running.map((a) => (
                  <AgentCard key={a.id} agent={a} onOpen={() => handleOpenAgent(a)} onKill={() => handleKillAgent(a)} />
                ))}
              </>
            )}
            {completed.length > 0 && (
              <>
                <div
                  style={{
                    padding: '6px 14px 4px',
                    fontSize: 8,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    color: 'var(--text3)',
                    textTransform: 'uppercase',
                  }}
                >
                  Completed ({completed.length})
                </div>
                {completed.map((a) => (
                  <AgentCard key={a.id} agent={a} onOpen={() => handleOpenAgent(a)} onKill={() => handleKillAgent(a)} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          padding: '6px 12px',
          flexShrink: 0,
          fontSize: 9,
          color: 'var(--text3)',
          fontFamily: 'var(--mono)',
        }}
      >
        {agents.length} agent{agents.length !== 1 ? 's' : ''} · {running.length} active
      </div>

      <TokenUsagePanel />
    </div>
  )
}
