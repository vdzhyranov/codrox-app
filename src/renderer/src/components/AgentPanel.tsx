import { useRef, useEffect } from 'react'
import { useAgentStore } from '@renderer/store/agentStore'
import type { Agent } from '@renderer/store/agentStore'
import { AgentList } from '@renderer/components/AgentList'
import { usePTY } from '@renderer/hooks/usePTY'

// ── Agent Terminal ───────────────────────────────────────────────────────────

interface AgentTerminalProps {
  agent: Agent
  isVisible: boolean
}

function AgentTerminal({ agent, isVisible }: AgentTerminalProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  usePTY({
    ptyId: agent.ptyId,
    worktreeId: agent.worktreePath,
    cwd: agent.worktreePath,
    type: 'claude',
    containerRef,
  })

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        display: isVisible ? 'block' : 'none',
        background: '#18181b',
      }}
    />
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyAgentState(): JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: 'var(--text3)',
      }}
    >
      <span style={{ fontSize: 32, opacity: 0.3 }}>◈</span>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>No agents running</p>
        <p style={{ fontSize: 11, color: 'var(--text3)' }}>
          Click <strong style={{ color: 'var(--accent2)' }}>+ New Agent</strong> to launch a Claude
          agent
        </p>
      </div>
    </div>
  )
}

// ── Agent Panel (main export) ────────────────────────────────────────────────

interface AgentPanelProps {
  worktreePath: string
}

export function AgentPanel({ worktreePath }: AgentPanelProps): JSX.Element {
  const allAgents = useAgentStore((s) => s.agents)
  const activeAgentId = useAgentStore((s) => s.activeAgentId)
  const agents = Object.values(allAgents).filter((a) => a.worktreePath === worktreePath)
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)

  // When a new agent is created and none is active for this worktree, activate it
  useEffect(() => {
    if (!activeAgentId && agents.length > 0) {
      setActiveAgent(agents[agents.length - 1].id)
    }
  }, [agents, activeAgentId, setActiveAgent])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AgentList worktreePath={worktreePath} />

      {agents.length === 0 ? (
        <EmptyAgentState />
      ) : (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {agents.map((agent) => (
            <AgentTerminal
              key={agent.id}
              agent={agent}
              isVisible={agent.id === activeAgentId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
