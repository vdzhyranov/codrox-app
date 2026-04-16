import { useState, useRef, useCallback, useEffect } from 'react'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import type { LifecyclePhase, LifecycleState } from '@shared/types'

// ─── Shared styles ───────────────────────────────────────────────

const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--sans)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text3)',
  marginBottom: 10,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const fieldLabel: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--text3)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '9px 12px',
  color: 'var(--text)',
  fontFamily: 'var(--mono)',
  fontSize: 12,
  outline: 'none',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical' as const,
  minHeight: 80,
  lineHeight: 1.6,
}

const bannerStyle = (color: string, dimColor: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 16px',
  background: dimColor,
  borderBottom: `1px solid ${color}33`,
  fontSize: 11,
  color,
  flexShrink: 0,
})

const addButtonStyle: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 6,
  fontSize: 11,
  fontFamily: 'var(--mono)',
  cursor: 'pointer',
  border: '1px solid rgba(124,106,247,.35)',
  background: 'var(--accent-dim)',
  color: 'var(--accent2)',
  transition: 'all .12s',
}

const startButtonStyle = (color: string, dimColor: string, borderColor: string): React.CSSProperties => ({
  padding: '10px 20px',
  borderRadius: 6,
  fontSize: 12,
  fontFamily: 'var(--mono)',
  cursor: 'pointer',
  border: `1px solid ${borderColor}`,
  background: dimColor,
  color,
  transition: 'all .12s',
  fontWeight: 600,
})

// ─── Context Builder ─────────────────────────────────────────────

function buildContext(lifecycle: LifecycleState, upToPhase: LifecyclePhase): string {
  const parts: string[] = []
  const p = lifecycle.propose

  if (p && (p.name || p.problem)) {
    parts.push(`## Proposal
**Feature:** ${p.name || '(unnamed)'}
**Problem:** ${p.problem || '(not specified)'}
**Solution:** ${p.solution || '(not specified)'}
**Success Criteria:** ${p.criteria || '(not specified)'}${p.questions ? `\n**Open Questions:** ${p.questions}` : ''}`)
  }

  if (upToPhase !== 'grill' && lifecycle.grillSummary) {
    parts.push(`## Grill Findings\n${lifecycle.grillSummary}`)
  }

  if (upToPhase !== 'research' && lifecycle.researchSummary) {
    parts.push(`## Research Findings\n${lifecycle.researchSummary}`)
  }

  if (lifecycle.plan?.tasks && lifecycle.plan.tasks.length > 0) {
    const taskList = lifecycle.plan.tasks
      .map((t, i) => `${i + 1}. [${t.done ? 'x' : ' '}] ${t.title}${t.effort ? ` (~${t.effort})` : ''}`)
      .join('\n')
    parts.push(`## Plan\n${taskList}`)
  }

  if (lifecycle.implementNotes) {
    parts.push(`## Implementation Notes\n${lifecycle.implementNotes}`)
  }

  return parts.join('\n\n')
}

// ─── PhaseTerminal ────────────────────────────────────────────────

interface PhaseTerminalProps {
  id: string
  worktreePath: string
  type: 'claude' | 'terminal'
  label: string
  color: string
  dimColor: string
  borderColor: string
  initialPrompt?: string
  autoStart?: boolean
}

function PhaseTerminal({
  id,
  worktreePath,
  type,
  label,
  color,
  dimColor,
  borderColor,
  initialPrompt,
  autoStart = false,
}: PhaseTerminalProps): JSX.Element {
  const [started, setStarted] = useState(autoStart)
  const containerRef = useRef<HTMLDivElement>(null)

  // Import xterm lazily when started
  useEffect(() => {
    if (!started) return
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let rafId: number | null = null
    let cleanup: (() => void) | null = null

    const init = async (): Promise<void> => {
      if (cancelled) return

      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        rafId = requestAnimationFrame(() => { init() })
        return
      }

      rafId = null

      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      const { Unicode11Addon } = await import('@xterm/addon-unicode11')
      const { WebLinksAddon } = await import('@xterm/addon-web-links')
      await import('@xterm/xterm/css/xterm.css')

      if (cancelled) return

      const term = new Terminal({
        allowProposedApi: true,
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
        theme: {
          background: '#18181b',
          foreground: '#f8f8fc',
          cursor: '#f8f8fc',
          selectionBackground: '#3f3f46',
          black: '#18181b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#f4f4f5',
        },
      })

      const fitAddon = new FitAddon()
      const unicode11 = new Unicode11Addon()
      const webLinks = new WebLinksAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(unicode11)
      term.loadAddon(webLinks)
      term.unicode.activeVersion = '11'
      term.open(container)
      fitAddon.fit()

      // Copy on select: auto-copy to clipboard when text is selected with mouse
      term.onSelectionChange(() => {
        const sel = term.getSelection()
        if (sel) window.api.clipboardWriteText(sel)
      })

      // Clipboard: Cmd+C to copy selection, Cmd+V to paste
      term.attachCustomKeyEventHandler((e) => {
        if (e.type === 'keydown' && e.metaKey) {
          if (e.key === 'c') {
            const sel = term.getSelection()
            if (sel) window.api.clipboardWriteText(sel)
            return false
          }
          if (e.key === 'v') {
            const text = window.api.clipboardReadText()
            if (text) window.api.invoke('pty:write', { id, data: text })
            return false
          }
        }
        return true
      })

      window.api.invoke('pty:create', { id, worktreeId: worktreePath, cwd: worktreePath, type })

      // Send initial prompt after a short delay to let Claude CLI start
      if (initialPrompt && type === 'claude') {
        setTimeout(() => {
          if (!cancelled) {
            window.api.invoke('pty:write', { id, data: initialPrompt + '\n' })
          }
        }, 2000)
      }

      term.onData((data) => {
        window.api.invoke('pty:write', { id, data })
      })

      const unsubOutput = window.api.on('pty:output', (payload: unknown) => {
        const p = payload as { id: string; data: string }
        if (p.id === id) term.write(p.data)
      })

      const unsubExit = window.api.on('pty:exit', (payload: unknown) => {
        const p = payload as { id: string; exitCode: number }
        if (p.id === id) {
          term.write(`\r\n\x1b[90m[Process exited with code ${p.exitCode}]\x1b[0m\r\n`)
        }
      })

      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit()
          window.api.invoke('pty:resize', { id, cols: term.cols, rows: term.rows })
        } catch {
          // ignore during layout transitions
        }
      })
      resizeObserver.observe(container)

      cleanup = (): void => {
        unsubOutput()
        unsubExit()
        resizeObserver.disconnect()
        term.dispose()
        window.api.invoke('pty:destroy', { id })
      }
    }

    rafId = requestAnimationFrame(() => { init() })

    return () => {
      cancelled = true
      if (rafId !== null) cancelAnimationFrame(rafId)
      cleanup?.()
    }
  }, [started, id, worktreePath, type])

  if (!started) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <button
          style={startButtonStyle(color, dimColor, borderColor)}
          onClick={() => setStarted(true)}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          ▶ Start {label}
        </button>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>
          Launches a {type === 'claude' ? 'Claude AI' : 'terminal'} session
        </span>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        background: '#18181b',
        minHeight: 300,
        overflow: 'hidden',
      }}
    />
  )
}

// ─── Propose Phase ───────────────────────────────────────────────

export function ProposePhase({
  worktreePath,
  lifecycle,
}: {
  worktreePath: string
  lifecycle: LifecycleState
}): JSX.Element {
  const updateLifecycleData = useWorkspaceStore((s) => s.updateLifecycleData)
  const propose = lifecycle.propose ?? { name: '', problem: '', solution: '', criteria: '' }

  const update = (field: keyof NonNullable<LifecycleState['propose']>, value: string): void => {
    updateLifecycleData(worktreePath, { propose: { ...propose, [field]: value } })
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={sectionTitle}>Feature Brief</div>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '18px 20px',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={fieldLabel}>Feature Name</div>
            <input
              style={inputStyle}
              value={propose.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. JWT Authentication with Refresh Tokens"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={fieldLabel}>Problem Statement</div>
            <textarea
              style={textareaStyle}
              value={propose.problem}
              onChange={(e) => update('problem', e.target.value)}
              placeholder="What problem does this solve?"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={fieldLabel}>Proposed Solution</div>
            <textarea
              style={textareaStyle}
              value={propose.solution}
              onChange={(e) => update('solution', e.target.value)}
              placeholder="How will you solve it?"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={fieldLabel}>Success Criteria</div>
            <textarea
              style={{ ...textareaStyle, minHeight: 70 }}
              value={propose.criteria}
              onChange={(e) => update('criteria', e.target.value)}
              placeholder="How will you know it's done?"
            />
          </div>
          <div>
            <div style={fieldLabel}>Open Questions</div>
            <textarea
              style={{ ...textareaStyle, minHeight: 60 }}
              value={propose.questions ?? ''}
              onChange={(e) => update('questions', e.target.value)}
              placeholder="Any open questions or unknowns?"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Grill Phase ─────────────────────────────────────────────────

export function GrillPhase({
  worktreePath,
}: {
  worktreePath: string
}): JSX.Element {
  const ptyId = `grill-${worktreePath}`
  const lifecycleByWorktree = useWorkspaceStore((s) => s.lifecycleByWorktree)
  const updateLifecycleData = useWorkspaceStore((s) => s.updateLifecycleData)
  const lifecycle = lifecycleByWorktree[worktreePath] ?? { phase: null }
  const context = buildContext(lifecycle, 'grill')

  const grillPrompt = context
    ? `You are in GRILL MODE. Act as an adversarial reviewer. Stress-test this proposal by challenging assumptions, surfacing blind spots, and exposing gaps. Be direct and specific.

${context}

Now grill me. Start with your toughest challenge.`
    : 'You are in GRILL MODE. Ask the user to describe what they want to build, then challenge their assumptions.'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={bannerStyle('#f87171', 'rgba(248,113,113,0.08)')}>
        <span>⚡</span>
        <span>Grill mode — Claude is stress-testing your proposal</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PhaseTerminal
          id={ptyId}
          worktreePath={worktreePath}
          type="claude"
          label="Grill Session"
          color="#f87171"
          dimColor="rgba(248,113,113,0.13)"
          borderColor="rgba(248,113,113,0.35)"
          initialPrompt={grillPrompt}
          autoStart
        />
      </div>
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={fieldLabel}>Grill Summary (save key findings before advancing)</div>
        <textarea
          style={{ ...textareaStyle, minHeight: 60 }}
          placeholder="Capture the key challenges, decisions, and risks surfaced during the grill..."
          value={lifecycle.grillSummary ?? ''}
          onChange={(e) => updateLifecycleData(worktreePath, { grillSummary: e.target.value })}
        />
      </div>
    </div>
  )
}

// ─── Research Phase ───────────────────────────────────────────────

export function ResearchPhase({
  worktreePath,
}: {
  worktreePath: string
}): JSX.Element {
  const ptyId = `research-${worktreePath}`
  const lifecycleByWorktree = useWorkspaceStore((s) => s.lifecycleByWorktree)
  const updateLifecycleData = useWorkspaceStore((s) => s.updateLifecycleData)
  const lifecycle = lifecycleByWorktree[worktreePath] ?? { phase: null }
  const context = buildContext(lifecycle, 'research')

  const researchPrompt = context
    ? `You are in RESEARCH MODE. Investigate this codebase and surface everything relevant before we plan implementation.

${context}

Categorize your findings as:
- PATTERN — existing code to build on
- RISK — conflicts, security gaps, scale concerns
- DEPENDENCY — packages/APIs already available
- INSIGHT — non-obvious conclusions

Start by reading the project structure and relevant files.`
    : 'You are in RESEARCH MODE. Investigate this codebase. Read the project structure, key files, dependencies, and surface patterns, risks, and insights.'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={bannerStyle('#60a5fa', 'rgba(96,165,250,0.08)')}>
        <span>⊡</span>
        <span>Research mode — Claude is investigating the codebase</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PhaseTerminal
          id={ptyId}
          worktreePath={worktreePath}
          type="claude"
          label="Research Session"
          color="#60a5fa"
          dimColor="rgba(96,165,250,0.13)"
          borderColor="rgba(96,165,250,0.35)"
          initialPrompt={researchPrompt}
          autoStart
        />
      </div>
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={fieldLabel}>Research Summary (save findings before advancing)</div>
        <textarea
          style={{ ...textareaStyle, minHeight: 60 }}
          placeholder="Capture key patterns, risks, dependencies, and insights found..."
          value={lifecycle.researchSummary ?? ''}
          onChange={(e) => updateLifecycleData(worktreePath, { researchSummary: e.target.value })}
        />
      </div>
    </div>
  )
}

// ─── Plan Phase ───────────────────────────────────────────────────

export function PlanPhase({
  worktreePath,
  lifecycle,
}: {
  worktreePath: string
  lifecycle: LifecycleState
}): JSX.Element {
  const updateLifecycleData = useWorkspaceStore((s) => s.updateLifecycleData)
  const [newTask, setNewTask] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const tasks = lifecycle.plan?.tasks ?? []

  const addTask = (): void => {
    if (!newTask.trim()) return
    const updated = [
      ...tasks,
      { id: `task-${Date.now()}`, title: newTask.trim(), done: false },
    ]
    updateLifecycleData(worktreePath, { plan: { tasks: updated } })
    setNewTask('')
  }

  const toggleTask = (id: string): void => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    updateLifecycleData(worktreePath, { plan: { tasks: updated } })
  }

  const removeTask = (id: string): void => {
    const updated = tasks.filter((t) => t.id !== id)
    updateLifecycleData(worktreePath, { plan: { tasks: updated } })
  }

  const startEdit = (id: string, title: string): void => {
    setEditingId(id)
    setEditValue(title)
  }

  const commitEdit = (id: string): void => {
    if (editValue.trim()) {
      const updated = tasks.map((t) => (t.id === id ? { ...t, title: editValue.trim() } : t))
      updateLifecycleData(worktreePath, { plan: { tasks: updated } })
    }
    setEditingId(null)
  }

  const updateEffort = (id: string, effort: string): void => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, effort } : t))
    updateLifecycleData(worktreePath, { plan: { tasks: updated } })
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={sectionTitle}>Task List</div>
        {tasks.map((task, i) => (
          <div
            key={task.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
                background: task.done ? 'var(--green-dim)' : 'var(--surface2)',
                border: task.done
                  ? '1px solid rgba(62,207,142,.3)'
                  : '1px solid var(--border)',
                color: task.done ? 'var(--green)' : 'var(--text3)',
                cursor: 'pointer',
              }}
              onClick={() => toggleTask(task.id)}
            >
              {task.done ? '✓' : i + 1}
            </div>
            {editingId === task.id ? (
              <input
                style={{ ...inputStyle, flex: 1, padding: '4px 8px', fontSize: 12 }}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitEdit(task.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit(task.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                autoFocus
              />
            ) : (
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: task.done ? 'var(--text3)' : 'var(--text)',
                  textDecoration: task.done ? 'line-through' : 'none',
                  cursor: 'text',
                }}
                onDoubleClick={() => startEdit(task.id, task.title)}
                title="Double-click to edit"
              >
                {task.title}
              </span>
            )}
            <input
              style={{
                width: 64,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '3px 6px',
                color: 'var(--text3)',
                fontFamily: 'var(--mono)',
                fontSize: 10,
                outline: 'none',
                flexShrink: 0,
              }}
              value={task.effort ?? ''}
              onChange={(e) => updateEffort(task.id, e.target.value)}
              placeholder="effort"
              title="Effort estimate"
            />
            <button
              onClick={() => removeTask(task.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text3)',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                padding: '0 2px',
                opacity: 0.5,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5' }}
            >
              ×
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="Add a task…"
          />
          <button
            onClick={addTask}
            style={addButtonStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,106,247,.22)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-dim)' }}
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Implement Phase ──────────────────────────────────────────────

export function ImplementPhase({
  worktreePath,
  lifecycle,
}: {
  worktreePath: string
  lifecycle: LifecycleState
}): JSX.Element {
  const updateLifecycleData = useWorkspaceStore((s) => s.updateLifecycleData)
  const ptyId = `implement-${worktreePath}`
  const tasks = lifecycle.plan?.tasks ?? []
  const context = buildContext(lifecycle, 'implement')
  const done = tasks.filter((t) => t.done).length

  const toggleTask = useCallback((id: string): void => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    updateLifecycleData(worktreePath, { plan: { tasks: updated } })
  }, [tasks, updateLifecycleData, worktreePath])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={bannerStyle('#3ecf8e', 'rgba(62,207,142,0.08)')}>
        <span>⟩</span>
        <span>Implement — Working through the plan</span>
        {tasks.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text3)' }}>
            {done}/{tasks.length} tasks done
          </span>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Task list — 40% */}
        <div
          style={{
            width: '40%',
            minWidth: 200,
            borderRight: '1px solid var(--border)',
            overflowY: 'auto',
            padding: '16px 12px',
            flexShrink: 0,
          }}
        >
          <div style={{ ...sectionTitle, marginBottom: 8 }}>Tasks</div>
          {tasks.length === 0 ? (
            <p style={{ fontSize: 10, color: 'var(--text3)', margin: 0 }}>
              No tasks — go back to Plan phase to add tasks.
            </p>
          ) : (
            tasks.map((task, i) => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  marginBottom: 6,
                  cursor: 'pointer',
                }}
                onClick={() => toggleTask(task.id)}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    flexShrink: 0,
                    background: task.done ? 'var(--green-dim)' : 'var(--surface2)',
                    border: task.done
                      ? '1px solid rgba(62,207,142,.3)'
                      : '1px solid var(--border)',
                    color: task.done ? 'var(--green)' : 'var(--text3)',
                  }}
                >
                  {task.done ? '✓' : i + 1}
                </div>
                <span
                  style={{
                    flex: 1,
                    fontSize: 11,
                    color: task.done ? 'var(--text3)' : 'var(--text)',
                    textDecoration: task.done ? 'line-through' : 'none',
                  }}
                >
                  {task.title}
                </span>
                {task.effort && (
                  <span style={{ fontSize: 9, color: 'var(--text3)', flexShrink: 0 }}>
                    {task.effort}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
        {/* Claude — 60% */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PhaseTerminal
            id={ptyId}
            worktreePath={worktreePath}
            type="claude"
            label="Implementation Session"
            color="#3ecf8e"
            dimColor="rgba(62,207,142,0.13)"
            borderColor="rgba(62,207,142,0.35)"
            initialPrompt={context ? `You are in IMPLEMENT MODE. Execute the plan below. Work through each task in order.

${context}

Start with task 1. Write the code, then tell me when it's done so I can check it off.` : undefined}
            autoStart
          />
        </div>
      </div>
    </div>
  )
}

// ─── Verify Phase ─────────────────────────────────────────────────

export function VerifyPhase({
  worktreePath,
  lifecycle,
}: {
  worktreePath: string
  lifecycle: LifecycleState
}): JSX.Element {
  const updateLifecycleData = useWorkspaceStore((s) => s.updateLifecycleData)
  const [newItem, setNewItem] = useState('')
  const [showTerminal, setShowTerminal] = useState(false)
  const ptyId = `verify-${worktreePath}`

  const items = lifecycle.verify?.items ?? []

  const addItem = (): void => {
    if (!newItem.trim()) return
    const updated = [
      ...items,
      { id: `verify-${Date.now()}`, label: newItem.trim(), passed: null },
    ]
    updateLifecycleData(worktreePath, { verify: { items: updated } })
    setNewItem('')
  }

  const setStatus = (id: string, passed: boolean | null): void => {
    const updated = items.map((item) => (item.id === id ? { ...item, passed } : item))
    updateLifecycleData(worktreePath, { verify: { items: updated } })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={sectionTitle}>Verification Checklist</div>
            <button
              onClick={() => setShowTerminal((v) => !v)}
              style={{
                padding: '5px 12px',
                borderRadius: 5,
                fontSize: 10,
                fontFamily: 'var(--mono)',
                cursor: 'pointer',
                border: '1px solid rgba(62,207,142,.35)',
                background: showTerminal ? 'var(--green-dim)' : 'transparent',
                color: 'var(--green)',
                transition: 'all .12s',
              }}
            >
              {showTerminal ? '▼ Tests' : '▶ Run Tests'}
            </button>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                background: 'var(--surface)',
                border: `1px solid ${
                  item.passed === true
                    ? 'rgba(62,207,142,.3)'
                    : item.passed === false
                    ? 'rgba(248,113,113,.3)'
                    : 'var(--border)'
                }`,
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {item.passed === true ? '✓' : item.passed === false ? '✗' : '○'}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color:
                    item.passed === true
                      ? 'var(--green)'
                      : item.passed === false
                      ? 'var(--red)'
                      : 'var(--text)',
                }}
              >
                {item.label}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setStatus(item.id, true)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontFamily: 'var(--mono)',
                    cursor: 'pointer',
                    border: '1px solid rgba(62,207,142,.3)',
                    background: item.passed === true ? 'var(--green-dim)' : 'transparent',
                    color: 'var(--green)',
                    transition: 'all .12s',
                  }}
                >
                  Pass
                </button>
                <button
                  onClick={() => setStatus(item.id, false)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontFamily: 'var(--mono)',
                    cursor: 'pointer',
                    border: '1px solid rgba(248,113,113,.3)',
                    background: item.passed === false ? 'var(--red-dim)' : 'transparent',
                    color: 'var(--red)',
                    transition: 'all .12s',
                  }}
                >
                  Fail
                </button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder="Add a verification check…"
            />
            <button
              onClick={addItem}
              style={addButtonStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,106,247,.22)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-dim)' }}
            >
              + Add
            </button>
          </div>
        </div>
      </div>
      {showTerminal && (
        <div
          style={{
            height: 320,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              fontSize: 10,
              color: 'var(--text3)',
              flexShrink: 0,
            }}
          >
            Test Runner
          </div>
          <PhaseTerminal
            id={ptyId}
            worktreePath={worktreePath}
            type="terminal"
            label="Test Session"
            color="#3ecf8e"
            dimColor="rgba(62,207,142,0.13)"
            borderColor="rgba(62,207,142,0.35)"
          />
        </div>
      )}
    </div>
  )
}

// ─── Mode Picker ─────────────────────────────────────────────────

interface ModeCardProps {
  icon: string
  title: string
  desc: string
  color: string
  dimColor: string
  borderColor: string
  onClick: () => void
}

function ModeCard({ icon, title, desc, color, dimColor, borderColor, onClick }: ModeCardProps): JSX.Element {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 180,
        padding: '28px 20px',
        borderRadius: 12,
        border: `1px solid ${hovered ? borderColor : 'var(--border)'}`,
        background: hovered ? dimColor : 'var(--surface)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        transition: 'all .15s',
      }}
    >
      <span style={{ fontSize: 28, color: hovered ? color : 'var(--text3)', transition: 'color .15s' }}>
        {icon}
      </span>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 14,
            fontWeight: 700,
            color: hovered ? color : 'var(--text)',
            marginBottom: 6,
            transition: 'color .15s',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}

export function ModePicker({
  worktreePath,
  onSelectTerminal,
  onSelectClaude,
}: {
  worktreePath: string
  onSelectTerminal: () => void
  onSelectClaude: () => void
}): JSX.Element {
  const setWorktreeMode = useWorkspaceStore((s) => s.setWorktreeMode)
  const setLifecyclePhase = useWorkspaceStore((s) => s.setLifecyclePhase)

  const handleLifecycle = (): void => {
    setWorktreeMode(worktreePath, 'lifecycle')
    setLifecyclePhase(worktreePath, 'propose')
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        background: 'var(--bg)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text3)',
            marginBottom: 6,
          }}
        >
          Choose a mode
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          How do you want to work in this worktree?
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <ModeCard
          icon="⟩_"
          title="Terminal"
          desc="Quick work, direct access"
          color="var(--green)"
          dimColor="var(--green-dim)"
          borderColor="rgba(62,207,142,.35)"
          onClick={onSelectTerminal}
        />
        <ModeCard
          icon="◈"
          title="Claude"
          desc="Freeform AI assistance"
          color="var(--accent2)"
          dimColor="var(--accent-dim)"
          borderColor="rgba(124,106,247,.35)"
          onClick={onSelectClaude}
        />
        <ModeCard
          icon="◈→✓"
          title="Lifecycle"
          desc="Guided workflow"
          color="var(--amber)"
          dimColor="var(--amber-dim)"
          borderColor="rgba(245,158,11,.35)"
          onClick={handleLifecycle}
        />
      </div>
    </div>
  )
}

// ─── Phase Footer ─────────────────────────────────────────────────

const PHASES: LifecyclePhase[] = ['propose', 'grill', 'research', 'plan', 'implement', 'verify']

export function PhaseFooter({
  currentPhase,
  worktreePath,
}: {
  currentPhase: LifecyclePhase
  worktreePath: string
}): JSX.Element {
  const setLifecyclePhase = useWorkspaceStore((s) => s.setLifecyclePhase)
  const setWorktreeMode = useWorkspaceStore((s) => s.setWorktreeMode)

  const idx = PHASES.indexOf(currentPhase)
  const prevPhase = idx > 0 ? PHASES[idx - 1] : null
  const nextPhase = idx < PHASES.length - 1 ? PHASES[idx + 1] : null

  const phaseLabel = currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1)

  return (
    <div
      style={{
        padding: '14px 20px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
        Phase <span style={{ color: 'var(--text)' }}>{idx + 1}</span> of {PHASES.length} — {phaseLabel}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {prevPhase ? (
          <button
            onClick={() => setLifecyclePhase(worktreePath, prevPhase)}
            style={{
              padding: '6px 14px',
              borderRadius: 5,
              fontSize: 11,
              fontFamily: 'var(--mono)',
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text2)',
              transition: 'all .12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            ← Back
          </button>
        ) : (
          <button
            onClick={() => setWorktreeMode(worktreePath, null)}
            style={{
              padding: '6px 14px',
              borderRadius: 5,
              fontSize: 11,
              fontFamily: 'var(--mono)',
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text2)',
              transition: 'all .12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            ← Exit
          </button>
        )}
        {nextPhase && (
          <button
            onClick={() => setLifecyclePhase(worktreePath, nextPhase)}
            style={{
              padding: '6px 14px',
              borderRadius: 5,
              fontSize: 11,
              fontFamily: 'var(--mono)',
              cursor: 'pointer',
              border: '1px solid var(--accent)',
              background: 'var(--accent)',
              color: 'white',
              transition: 'all .12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent2)'; e.currentTarget.style.borderColor = 'var(--accent2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
          >
            Advance →
          </button>
        )}
        {!nextPhase && (
          <button
            onClick={() => setWorktreeMode(worktreePath, null)}
            style={{
              padding: '6px 14px',
              borderRadius: 5,
              fontSize: 11,
              fontFamily: 'var(--mono)',
              cursor: 'pointer',
              border: '1px solid var(--green)',
              background: 'var(--green-dim)',
              color: 'var(--green)',
              transition: 'all .12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(62,207,142,.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--green-dim)' }}
          >
            ✓ Complete
          </button>
        )}
      </div>
    </div>
  )
}
