import { useEffect, useState } from 'react'
import type { DetectedAgent } from '@renderer/store/agentStore'

interface AgentLogMessage {
  type: 'task' | 'tool_use' | 'text' | 'unknown'
  content: string
  toolName?: string
  input?: unknown
}

const TOOL_ICONS: Record<string, string> = {
  Read: '📖',
  Write: '✏️',
  Edit: '✏️',
  Bash: '⟩_',
  Glob: '🔍',
  Grep: '🔍',
  WebFetch: '🌐',
  WebSearch: '🌐',
  TodoWrite: '📋',
  Task: '◈',
}

function getToolIcon(toolName: string): string {
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (toolName.toLowerCase().includes(key.toLowerCase())) return icon
  }
  return '⚙'
}

function ToolRow({ msg }: { msg: AgentLogMessage }): JSX.Element {
  const icon = getToolIcon(msg.toolName ?? '')
  const label = msg.toolName ?? 'tool'
  const detail = msg.content ? ` ${msg.content}` : ''
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '5px 12px',
        borderBottom: '1px solid var(--border)',
        fontSize: 11,
        fontFamily: 'var(--mono)',
        color: 'var(--text2)',
      }}
    >
      <span style={{ flexShrink: 0, fontSize: 12, lineHeight: '16px' }}>{icon}</span>
      <span style={{ color: 'var(--accent2)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          color: 'var(--text3)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}
      >
        {detail}
      </span>
    </div>
  )
}

function TextRow({ msg }: { msg: AgentLogMessage }): JSX.Element {
  const truncated = msg.content.length > 200 ? msg.content.slice(0, 200) + '…' : msg.content
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '5px 12px',
        borderBottom: '1px solid var(--border)',
        fontSize: 11,
        fontFamily: 'var(--mono)',
        color: 'var(--text2)',
      }}
    >
      <span style={{ flexShrink: 0, fontSize: 12, lineHeight: '16px' }}>💬</span>
      <span style={{ color: 'var(--text3)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {truncated}
      </span>
    </div>
  )
}

function TaskRow({ msg }: { msg: AgentLogMessage }): JSX.Element {
  const truncated = msg.content.length > 300 ? msg.content.slice(0, 300) + '…' : msg.content
  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface2)',
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text3)',
          marginBottom: 4,
        }}
      >
        Task
      </div>
      <div
        style={{
          fontSize: 11,
          fontFamily: 'var(--mono)',
          color: 'var(--text)',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {truncated}
      </div>
    </div>
  )
}

// ── Agent Log Viewer ─────────────────────────────────────────────────────────

interface AgentLogViewerProps {
  agent: DetectedAgent
  onClose: () => void
}

export function AgentLogViewer({ agent, onClose }: AgentLogViewerProps): JSX.Element {
  const [messages, setMessages] = useState<AgentLogMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async (): Promise<void> => {
      const result = await window.api.invoke('agents:readLog', { filePath: agent.filePath }) as AgentLogMessage[]
      if (!cancelled) {
        setMessages(result)
        setLoading(false)
      }
    }

    load()

    // Refresh every 3s if running
    let interval: NodeJS.Timeout | null = null
    if (agent.status === 'running') {
      interval = setInterval(load, 3000)
    }

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [agent.filePath, agent.status])

  const statusDot = agent.status === 'running' ? '#3ecf8e' : '#555568'
  const statusLabel = agent.status === 'running' ? 'running' : 'done'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 40,
          flexShrink: 0,
          padding: '0 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: statusDot,
            flexShrink: 0,
            ...(agent.status === 'running' ? { animation: 'pulse 2s infinite' } : {}),
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--mono)',
            fontWeight: 600,
            color: 'var(--text)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {agent.id}
        </span>
        <span
          style={{
            fontSize: 9,
            color: 'var(--text3)',
            fontFamily: 'var(--mono)',
            flexShrink: 0,
          }}
        >
          {statusLabel}
        </span>
        <button
          onClick={onClose}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: 'var(--text3)',
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            padding: 0,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
        >
          ×
        </button>
      </div>

      {/* Stats bar */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          <span style={{ color: 'var(--text2)' }}>{agent.toolCalls}</span> tools
        </span>
        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          <span style={{ color: 'var(--text2)' }}>{agent.textMessages}</span> messages
        </span>
      </div>

      {/* Log messages */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 80,
              fontSize: 11,
              color: 'var(--text3)',
              fontFamily: 'var(--mono)',
            }}
          >
            Loading...
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 80,
              fontSize: 11,
              color: 'var(--text3)',
              fontFamily: 'var(--mono)',
            }}
          >
            No log entries yet
          </div>
        ) : (
          messages.map((msg, i) => {
            if (msg.type === 'task') return <TaskRow key={i} msg={msg} />
            if (msg.type === 'tool_use') return <ToolRow key={i} msg={msg} />
            if (msg.type === 'text') return <TextRow key={i} msg={msg} />
            return null
          })
        )}
        {agent.status === 'running' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              fontSize: 11,
              fontFamily: 'var(--mono)',
              color: 'var(--text3)',
            }}
          >
            <span className="pulse" style={{ color: 'var(--green)' }}>⏳</span>
            Working...
          </div>
        )}
      </div>
    </div>
  )
}
