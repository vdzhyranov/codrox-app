import { useState, useEffect } from 'react'
import { useAgentStore } from '@renderer/store/agentStore'
import type { Agent, AgentStatus } from '@renderer/store/agentStore'

// ── Runtime display ──────────────────────────────────────────────────────────

function useRuntime(startedAt: number): string {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const elapsed = Math.floor((now - startedAt) / 1000)
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AgentStatus, { dot: string; label: string; icon: string }> = {
  running: { dot: '#3ecf8e', label: 'running', icon: '⟳' },
  waiting: { dot: '#f59e0b', label: 'waiting', icon: '⏸' },
  done: { dot: '#555568', label: 'done', icon: '✓' },
  error: { dot: '#f87171', label: 'error', icon: '✕' },
}

// ── New Agent Dialog ─────────────────────────────────────────────────────────

interface NewAgentDialogProps {
  worktreePath: string
  onClose: () => void
}

function NewAgentDialog({ worktreePath, onClose }: NewAgentDialogProps): JSX.Element {
  const [task, setTask] = useState('')
  const createAgent = useAgentStore((s) => s.createAgent)

  const handleSubmit = (): void => {
    const trimmed = task.trim()
    if (!trimmed) return
    createAgent(worktreePath, trimmed)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border2)',
          borderRadius: 10,
          padding: 20,
          width: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text3)',
          }}
        >
          New Agent
        </div>
        <textarea
          autoFocus
          placeholder="What should this agent do?"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '9px 12px',
            color: 'var(--text)',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            outline: 'none',
            resize: 'none',
            minHeight: 72,
            lineHeight: 1.6,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px',
              borderRadius: 5,
              fontSize: 11,
              fontFamily: 'var(--mono)',
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text3)',
              transition: 'all .12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text2)'
              e.currentTarget.style.borderColor = 'var(--border2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text3)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!task.trim()}
            style={{
              padding: '7px 14px',
              borderRadius: 5,
              fontSize: 11,
              fontFamily: 'var(--mono)',
              cursor: task.trim() ? 'pointer' : 'not-allowed',
              border: '1px solid rgba(124,106,247,.35)',
              background: 'var(--accent-dim)',
              color: task.trim() ? 'var(--accent2)' : 'var(--text3)',
              transition: 'all .12s',
            }}
            onMouseEnter={(e) => {
              if (task.trim()) e.currentTarget.style.background = 'rgba(124,106,247,.22)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent-dim)'
            }}
          >
            Launch Agent
          </button>
        </div>
        <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'right' }}>
          Enter to launch · Shift+Enter for newline · Esc to cancel
        </div>
      </div>
    </div>
  )
}

// ── Agent pill ───────────────────────────────────────────────────────────────

interface AgentPillProps {
  agent: Agent
  isActive: boolean
  onClick: () => void
}

function AgentPill({ agent, isActive, onClick }: AgentPillProps): JSX.Element {
  const cfg = STATUS_CONFIG[agent.status]
  const runtime = useRuntime(agent.startedAt)

  return (
    <div
      onClick={onClick}
      title={agent.task}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '0 12px',
        height: 34,
        borderRadius: 6,
        cursor: 'pointer',
        flexShrink: 0,
        background: isActive ? 'var(--surface2)' : 'transparent',
        border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
        transition: 'all .12s',
        maxWidth: 220,
        minWidth: 0,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--surface2)'
          e.currentTarget.style.borderColor = 'var(--border2)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = 'var(--border)'
        }
      }}
    >
      {/* Status dot */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {/* Name */}
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--mono)',
          color: isActive ? 'var(--text)' : 'var(--text2)',
          fontWeight: isActive ? 600 : 400,
          flexShrink: 0,
        }}
      >
        {agent.name}
      </span>
      {/* Task truncated */}
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
        {agent.task}
      </span>
      {/* Runtime */}
      <span
        style={{
          fontSize: 9,
          color: 'var(--text3)',
          flexShrink: 0,
        }}
      >
        {runtime}
      </span>
    </div>
  )
}

// ── Agent List strip ─────────────────────────────────────────────────────────

interface AgentListProps {
  worktreePath: string
}

export function AgentList({ worktreePath }: AgentListProps): JSX.Element {
  const [showDialog, setShowDialog] = useState(false)
  const allAgents = useAgentStore((s) => s.agents)
  const activeAgentId = useAgentStore((s) => s.activeAgentId)
  const agents = Object.values(allAgents).filter((a) => a.worktreePath === worktreePath)
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)

  return (
    <>
      <div
        style={{
          height: 48,
          flexShrink: 0,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {/* Label */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text3)',
            flexShrink: 0,
            marginRight: 4,
          }}
        >
          Agents
        </span>

        {/* Agent pills */}
        {agents.map((agent) => (
          <AgentPill
            key={agent.id}
            agent={agent}
            isActive={agent.id === activeAgentId}
            onClick={() => setActiveAgent(agent.id)}
          />
        ))}

        {/* New agent button */}
        <button
          onClick={() => setShowDialog(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '0 10px',
            height: 30,
            borderRadius: 6,
            fontSize: 11,
            fontFamily: 'var(--mono)',
            cursor: 'pointer',
            border: '1px solid rgba(124,106,247,.35)',
            background: 'var(--accent-dim)',
            color: 'var(--accent2)',
            flexShrink: 0,
            transition: 'all .12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(124,106,247,.22)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent-dim)'
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>+</span>
          <span>New Agent</span>
        </button>
      </div>

      {showDialog && (
        <NewAgentDialog worktreePath={worktreePath} onClose={() => setShowDialog(false)} />
      )}
    </>
  )
}
