import { useState, useEffect, useRef } from 'react'
import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'

interface Message {
  role: 'user' | 'assistant' | 'system'
  text: string
}

function parseJSONL(content: string): Message[] {
  const messages: Message[] = []
  const lines = content.split('\n').filter((l) => l.trim())

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>
      const type = parsed.type as string
      const msg = parsed.message as Record<string, unknown> | undefined

      if (type === 'user' || type === 'assistant') {
        let text = ''
        const msgContent = msg?.content
        if (typeof msgContent === 'string') {
          text = msgContent
        } else if (Array.isArray(msgContent)) {
          for (const part of msgContent) {
            const p = part as Record<string, unknown>
            if (p.type === 'text' && typeof p.text === 'string') {
              text += p.text
            } else if (p.type === 'tool_use') {
              text += `[Tool: ${p.name}]\n`
            } else if (p.type === 'tool_result') {
              const content = p.content
              if (typeof content === 'string') {
                text += content.slice(0, 200) + (content.length > 200 ? '...' : '')
              }
            }
          }
        }

        if (text.trim()) {
          messages.push({
            role: type as 'user' | 'assistant',
            text: text.trim(),
          })
        }
      }
    } catch {
      // skip invalid JSON lines
    }
  }

  return messages
}

export function AgentOutputViewer({ agentId }: { agentId: string }): JSX.Element {
  const activeWorktreePath = useActiveWorktreePath()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeWorktreePath) return

    let cancelled = false

    const loadOutput = async (): Promise<void> => {
      // Try to find the agent output file
      const projectKey = activeWorktreePath.replace(/\//g, '-')
      const baseDir = `/private/tmp/claude-501/${projectKey}`

      try {
        // List session dirs to find the output file
        const result = await window.api.invoke('fs:readDir', { path: baseDir })
        const tree = result as { children?: Array<{ name: string; path: string; type: string }> }
        const sessionDirs = tree.children?.filter((c) => c.type === 'directory') ?? []

        let content: string | null = null

        for (const dir of sessionDirs) {
          const filePath = `${dir.path}/tasks/${agentId}.output`
          try {
            const fileResult = (await window.api.invoke('fs:readFile', { path: filePath })) as { content: string }
            if (fileResult.content) {
              content = fileResult.content
              break
            }
          } catch {
            // not in this session dir
          }
        }

        if (cancelled) return

        if (content) {
          setMessages(parseJSONL(content))
          setLoading(false)
        } else {
          setError('Agent output not found')
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load agent output')
          setLoading(false)
        }
      }
    }

    loadOutput()

    // Poll for updates every 2s
    const interval = setInterval(loadOutput, 2000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [agentId, activeWorktreePath])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>Loading agent output...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--red)' }}>{error}</span>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'var(--bg)',
      }}
    >
      {messages.map((msg, i) => (
        <div
          key={i}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            background: msg.role === 'user' ? 'var(--surface2)' : 'var(--surface)',
            borderLeft: msg.role === 'assistant'
              ? '3px solid var(--accent)'
              : '3px solid var(--green)',
          }}
        >
          <div
            style={{
              fontSize: 8,
              fontWeight: 600,
              color: msg.role === 'assistant' ? 'var(--accent2)' : 'var(--green)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 4,
            }}
          >
            {msg.role}
          </div>
          <pre
            style={{
              fontSize: 11,
              color: 'var(--text)',
              fontFamily: 'var(--mono)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}
          >
            {msg.text}
          </pre>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
