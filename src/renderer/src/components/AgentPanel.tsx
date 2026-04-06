import { useRef, useEffect, useState } from 'react'
import { useAgentStore } from '@renderer/store/agentStore'
import type { Agent, DetectedAgent } from '@renderer/store/agentStore'
import { AgentList } from '@renderer/components/AgentList'
import { AgentLogViewer } from '@renderer/components/AgentLogViewer'
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

// ── Detected sub-agent pill ──────────────────────────────────────────────────

interface DetectedAgentPillProps {
  agent: DetectedAgent
  isSelected: boolean
  onClick: () => void
}

function DetectedAgentPill({ agent, isSelected, onClick }: DetectedAgentPillProps): JSX.Element {
  const isRunning = agent.status === 'running'
  const dotColor = isRunning ? '#3ecf8e' : '#555568'

  return (
    <div
      onClick={onClick}
      title={agent.taskDescription}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
        background: isSelected ? 'var(--surface2)' : 'transparent',
        transition: 'all .12s',
        minWidth: 0,
        flex: '0 0 auto',
        maxWidth: 240,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'var(--surface2)'
          e.currentTarget.style.borderColor = 'var(--border2)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = 'var(--border)'
        }
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          ...(isRunning ? { animation: 'pulse 2s infinite' } : {}),
        }}
      />
      <span
        style={{
          fontSize: 10,
          fontFamily: 'var(--mono)',
          color: isSelected ? 'var(--text)' : 'var(--text2)',
          flexShrink: 0,
          fontWeight: isSelected ? 600 : 400,
        }}
      >
        {agent.id.startsWith('agent-') ? agent.id : `agent-${agent.id.slice(0, 8)}`}
      </span>
      <span
        style={{
          fontSize: 10,
          color: 'var(--text3)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}
      >
        {agent.taskDescription}
      </span>
      <span style={{ fontSize: 9, color: 'var(--text3)', flexShrink: 0 }}>
        {agent.toolCalls}t
      </span>
    </div>
  )
}

// ── Sub-agent bottom panel ────────────────────────────────────────────────────

interface SubAgentPanelProps {
  detectedAgents: DetectedAgent[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

function SubAgentPanel({ detectedAgents, selectedId, onSelect }: SubAgentPanelProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const selectedAgent = detectedAgents.find((a) => a.id === selectedId) ?? null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        maxHeight: collapsed ? 32 : selectedAgent ? 260 : 120,
        transition: 'max-height .15s ease',
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 32,
          flexShrink: 0,
          padding: '0 12px',
          gap: 8,
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text3)',
          }}
        >
          Sub-Agents
        </span>
        <span
          style={{
            fontSize: 9,
            fontFamily: 'var(--mono)',
            color: 'var(--accent2)',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(124,106,247,.25)',
            borderRadius: 10,
            padding: '1px 6px',
          }}
        >
          {detectedAgents.length}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{collapsed ? '▲' : '▼'}</span>
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Agent list */}
          <div
            style={{
              flex: selectedAgent ? '0 0 220px' : '1',
              overflowY: 'auto',
              padding: '6px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {detectedAgents.map((agent) => (
              <DetectedAgentPill
                key={agent.id}
                agent={agent}
                isSelected={agent.id === selectedId}
                onClick={() => onSelect(agent.id === selectedId ? null : agent.id)}
              />
            ))}
          </div>

          {/* Log viewer */}
          {selectedAgent && (
            <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
              <AgentLogViewer agent={selectedAgent} onClose={() => onSelect(null)} />
            </div>
          )}
        </div>
      )}
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
  const detectedAgents = useAgentStore((s) => s.detectedAgents)
  const selectedDetectedAgentId = useAgentStore((s) => s.selectedDetectedAgentId)
  const startWatching = useAgentStore((s) => s.startWatching)
  const stopWatching = useAgentStore((s) => s.stopWatching)
  const setSelectedDetectedAgent = useAgentStore((s) => s.setSelectedDetectedAgent)

  // When a new agent is created and none is active for this worktree, activate it
  useEffect(() => {
    if (!activeAgentId && agents.length > 0) {
      setActiveAgent(agents[agents.length - 1].id)
    }
  }, [agents, activeAgentId, setActiveAgent])

  // Start watching for sub-agents when this panel mounts
  useEffect(() => {
    startWatching(worktreePath)
    return () => {
      stopWatching()
    }
  }, [worktreePath, startWatching, stopWatching])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AgentList worktreePath={worktreePath} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
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

      {/* Sub-agent observability panel */}
      {detectedAgents.length > 0 && (
        <SubAgentPanel
          detectedAgents={detectedAgents}
          selectedId={selectedDetectedAgentId}
          onSelect={setSelectedDetectedAgent}
        />
      )}
    </div>
  )
}
