import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import { FileTree } from '@renderer/components/FileTree'
import { GitChanges } from '@renderer/components/GitChanges'
import { AgentList } from '@renderer/components/AgentList'
import { BrowserTabs } from '@renderer/components/BrowserTabs'
import { GraphPanel } from '@renderer/components/GraphPanel'
import type { TokenSummary, TokenUsageRecord, UsageLimits } from '@shared/types/tokens'

type RightPanelTab = 'agents' | 'files' | 'git' | 'graph' | 'browser'

// Footer row heights
const ROW_H = 18
const LIMIT_ROW_H = 22
const FOOTER_H = ROW_H + ROW_H + LIMIT_ROW_H // 58px total

const MODEL_PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-haiku-4-5':           { input: 0.80,  output: 4.00,  cacheWrite: 1.00,  cacheRead: 0.08 },
  'claude-haiku-4-5-20251001':  { input: 0.80,  output: 4.00,  cacheWrite: 1.00,  cacheRead: 0.08 },
  'claude-sonnet-4-5':          { input: 3.00,  output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-sonnet-4-6':          { input: 3.00,  output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-opus-4-7':            { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
}

function getPricing(model: string) {
  for (const [key, p] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key) || key.startsWith(model)) return p
  }
  return { input: 3.00, output: 15.00, cacheWrite: 3.75, cacheRead: 0.30 }
}

function calcRecordCost(r: TokenUsageRecord): number {
  const p = getPricing(r.model)
  const M = 1_000_000
  return (r.inputTokens * p.input + r.outputTokens * p.output +
    r.cacheCreationTokens * p.cacheWrite + r.cacheReadTokens * p.cacheRead) / M
}

function calcSummaryCost(summary: TokenSummary): number {
  let total = 0
  for (const [model, m] of Object.entries(summary.byModel)) {
    const p = getPricing(model)
    const M = 1_000_000
    total += (m.inputTokens * p.input + m.outputTokens * p.output +
      m.cacheCreationTokens * p.cacheWrite + m.cacheReadTokens * p.cacheRead) / M
  }
  return total
}

function formatCost(usd: number): string {
  if (usd < 0.001) return '<$0.001'
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function shortModel(model: string): string {
  if (model.includes('haiku')) return 'Haiku'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('opus')) return 'Opus'
  return model.split('-')[1] ?? model
}

function GlobeIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function GraphIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="19" cy="5" r="2.5" />
      <circle cx="19" cy="19" r="2.5" />
      <line x1="7.3" y1="11" x2="16.7" y2="6.5" />
      <line x1="7.3" y1="13" x2="16.7" y2="17.5" />
    </svg>
  )
}

function LimitBar({ label, pct, resetsAt, stale }: { label: string; pct: number | null; resetsAt: string | null; stale?: boolean }): JSX.Element {
  if (pct === null) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>
        <span style={{ minWidth: 14 }}>{label}</span>
        <span>—</span>
      </span>
    )
  }
  const color = pct >= 80 ? 'var(--red)' : pct >= 50 ? 'var(--amber)' : 'var(--accent)'
  const resetStr = resetsAt ? `Resets ${new Date(resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''
  const title = [resetStr, stale ? '(stale)' : ''].filter(Boolean).join(' · ')
  return (
    <span
      title={title || undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontSize: 'var(--fs-xs)' }}
    >
      <span style={{ color: 'var(--text3)', minWidth: 14 }}>{label}</span>
      <div style={{ width: 28, height: 3, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .3s' }} />
      </div>
      <span style={{ color, minWidth: 28, textAlign: 'right', opacity: stale ? 0.6 : 1 }}>{pct}%</span>
    </span>
  )
}

function TabBtn({
  label,
  icon,
  badge,
  active,
  onClick,
}: {
  label: string
  icon?: ReactNode
  badge?: number
  active: boolean
  onClick: () => void
}): JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '0 10px',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        background: active || hovered ? 'var(--surface2)' : 'transparent',
        color: active ? 'var(--text)' : hovered ? 'var(--text2)' : 'var(--text3)',
        cursor: 'pointer',
        fontSize: 'var(--fs-xs)',
        fontWeight: active ? 600 : 500,
        letterSpacing: '0.1em',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        transition: 'color .1s, background .1s',
        flexShrink: 0,
        userSelect: 'none',
        height: '100%',
      }}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            padding: '1px 4px',
            borderRadius: 3,
            background: active ? 'rgba(124,106,247,.2)' : 'var(--surface3)',
            color: active ? 'var(--accent2)' : 'var(--text3)',
            border: `1px solid ${active ? 'rgba(124,106,247,.3)' : 'var(--border)'}`,
            fontFamily: 'var(--mono)',
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

interface AgentEntry {
  id: string
  task: string
  status: 'running' | 'completed'
  startedAt: number
}

export function RightPanel(): JSX.Element {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const activeWorktreePath = useActiveWorktreePath()

  const [tab, setTab] = useState<RightPanelTab>('agents')
  const [showTokenDetail, setShowTokenDetail] = useState(false)

  // Footer data
  const [branch, setBranch] = useState<string | null>(null)
  const [summary, setSummary] = useState<TokenSummary | null>(null)
  const [history, setHistory] = useState<TokenUsageRecord[]>([])
  const [agents, setAgents] = useState<AgentEntry[]>([])
  const [toolCount, setToolCount] = useState(0)
  const [gitFileCount, setGitFileCount] = useState(0)
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null)

  const agentCount = agents.length
  const runningCount = agents.filter((a) => a.status === 'running').length

  // Map agentId → task for token detail join
  const agentTaskMap = new Map(agents.map((a) => [a.id, a.task]))

  // Auto-switch to browser tab when a link is opened externally
  const switchToBrowser = useCallback(() => setTab('browser'), [])

  useEffect(() => {
    const handler = (): void => switchToBrowser()
    window.addEventListener('open-in-browser', handler)
    const unsubIpc = window.api.on('browser:open-url', () => switchToBrowser())
    return () => {
      window.removeEventListener('open-in-browser', handler)
      unsubIpc()
    }
  }, [switchToBrowser])

  const loadBranch = useCallback(async () => {
    if (!activeWorktreePath) return
    try {
      const b = (await window.api.invoke('git:branch', { path: activeWorktreePath })) as string | null
      setBranch(b)
    } catch {
      setBranch(null)
    }
  }, [activeWorktreePath])

  const loadTokens = useCallback(async () => {
    if (!activeWorktreePath) return
    try {
      const [s, h] = await Promise.all([
        window.api.invoke('tokens:getSummary', { workspacePath: activeWorktreePath }) as Promise<TokenSummary>,
        window.api.invoke('tokens:getHistory', { workspacePath: activeWorktreePath }) as Promise<TokenUsageRecord[]>,
      ])
      setSummary(s)
      setHistory(h)
    } catch { /* no data yet */ }
  }, [activeWorktreePath])

  const loadAgents = useCallback(async () => {
    if (!activeWorktreePath) return
    try {
      const result = (await window.api.invoke('agents:list', { workspacePath: activeWorktreePath })) as AgentEntry[]
      setAgents(result)
    } catch {
      setAgents([])
    }
  }, [activeWorktreePath])

  const loadGitCount = useCallback(async () => {
    if (!activeWorktreePath) return
    try {
      const changes = (await window.api.invoke('git:status', { worktreePath: activeWorktreePath })) as unknown[]
      setGitFileCount(changes.length)
    } catch {
      setGitFileCount(0)
    }
  }, [activeWorktreePath])

  const loadToolCount = useCallback(async () => {
    if (!activeWorktreePath) return
    try {
      const count = (await window.api.invoke('agents:toolCount', { workspacePath: activeWorktreePath })) as number
      setToolCount(count)
    } catch { /* no data */ }
  }, [activeWorktreePath])

  const loadUsageLimits = useCallback(async () => {
    try {
      const limits = (await window.api.invoke('claude:usageLimits', { workspaceId: activeWorkspaceId })) as UsageLimits | null
      setUsageLimits(limits)
    } catch { /* no data */ }
  }, [activeWorkspaceId])

  useEffect(() => {
    loadBranch()
    loadTokens()
    loadAgents()
    loadGitCount()
    loadToolCount()
    loadUsageLimits()

    const agentInterval = setInterval(() => {
      void loadAgents()
      void loadGitCount()
    }, 3000)
    const slowInterval = setInterval(() => {
      void loadTokens()
      void loadToolCount()
      void loadBranch()
    }, 10_000)
    const limitsInterval = setInterval(loadUsageLimits, 5 * 60 * 1000)

    return () => {
      clearInterval(agentInterval)
      clearInterval(slowInterval)
      clearInterval(limitsInterval)
    }
  }, [loadBranch, loadTokens, loadAgents, loadGitCount, loadToolCount, loadUsageLimits])

  // Clear stale limits immediately when switching workspaces
  useEffect(() => {
    setUsageLimits(null)
  }, [activeWorkspaceId])

  // Real usage limits from Anthropic API (via ClaudeUsageService)
  const limit5hPct = usageLimits?.fiveHourPercent ?? null
  const limit7dPct = usageLimits?.weeklyPercent ?? null

  const folderName = activeWorktreePath?.split('/').pop() ?? ''
  const totalCost = summary ? calcSummaryCost(summary) : 0

  const rowStyle = (borderTop = true): React.CSSProperties => ({
    height: ROW_H,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    gap: 5,
    fontSize: 'var(--fs-xs)',
    color: 'var(--text3)',
    fontFamily: 'var(--mono)',
    overflow: 'hidden',
    ...(borderTop ? { borderTop: '1px solid var(--border)' } : {}),
  })

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          height: 32,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'stretch',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <TabBtn label="AGENTS" active={tab === 'agents'} onClick={() => setTab('agents')} />
        <TabBtn label="FILES" active={tab === 'files'} onClick={() => setTab('files')} />
        <TabBtn label="GIT" badge={gitFileCount} active={tab === 'git'} onClick={() => setTab('git')} />
        <TabBtn label="GRAPH" icon={<GraphIcon />} active={tab === 'graph'} onClick={() => setTab('graph')} />
        <div style={{ flex: 1 }} />
        <TabBtn label="Browser" icon={<GlobeIcon />} active={tab === 'browser'} onClick={() => setTab('browser')} />
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {!activeWorktreePath ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
              {workspaces.length === 0 ? 'Add a workspace to begin' : 'Select a workspace'}
            </p>
          </div>
        ) : tab === 'browser' ? (
          <BrowserTabs onSwitchToPanel={() => setTab('agents')} />
        ) : tab === 'agents' ? (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <AgentList />
          </div>
        ) : tab === 'files' ? (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <FileTree />
          </div>
        ) : tab === 'git' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <GitChanges />
          </div>
        ) : tab === 'graph' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <GraphPanel />
          </div>
        ) : null}
      </div>

      {/* 3-row Claude resources footer */}
      {activeWorktreePath && (
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)' }}>

          {/* Row 1: Branch + folder */}
          <div style={rowStyle(false)}>
            {branch && (
              <>
                <span>⎇</span>
                <span
                  title={`Branch: ${branch}`}
                  style={{ color: 'var(--accent2)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {branch}
                </span>
                <span style={{ color: 'var(--border2)' }}>│</span>
              </>
            )}
            <span
              title={activeWorktreePath}
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
            >
              ~/{folderName}
            </span>
          </div>

          {/* Row 2: Agents + tools */}
          <div style={rowStyle()}>
            <span
              title={`${runningCount} running, ${agentCount} total`}
              style={{ display: 'flex', alignItems: 'center', gap: 3 }}
            >
              <span style={{ fontSize: 7, color: runningCount > 0 ? 'var(--amber)' : 'var(--text3)' }}>●</span>
              <span>{agentCount} agent{agentCount !== 1 ? 's' : ''}</span>
            </span>
            <span style={{ color: 'var(--border2)' }}>│</span>
            <span title={`${toolCount} tool calls`}>⚙ {toolCount} tools</span>
          </div>

          {/* Row 3: Limit bars + token toggle */}
          <div
            style={{
              height: LIMIT_ROW_H,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              gap: 10,
              borderTop: '1px solid var(--border)',
            }}
          >
            <LimitBar
              label="5h"
              pct={limit5hPct}
              resetsAt={usageLimits?.fiveHourResetsAt ?? null}
              stale={usageLimits?.stale}
            />
            <LimitBar
              label="7d"
              pct={limit7dPct}
              resetsAt={usageLimits?.weeklyResetsAt ?? null}
              stale={usageLimits?.stale}
            />
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setShowTokenDetail((v) => !v)}
              title={`Total: ${formatCost(totalCost)} — view breakdown`}
              style={{
                background: showTokenDetail ? 'var(--surface3)' : 'none',
                border: '1px solid ' + (showTokenDetail ? 'var(--border2)' : 'transparent'),
                borderRadius: 3,
                color: showTokenDetail ? 'var(--text2)' : 'var(--text3)',
                cursor: 'pointer',
                fontSize: 'var(--fs-xs)',
                fontFamily: 'var(--mono)',
                padding: '1px 6px',
                lineHeight: 1.4,
                transition: 'all .1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = showTokenDetail ? 'var(--text2)' : 'var(--text3)' }}
            >
              {formatCost(totalCost)}
            </button>
          </div>
        </div>
      )}

      {/* Token detail popover — appears above footer */}
      {showTokenDetail && activeWorktreePath && (
        <div
          style={{
            position: 'absolute',
            bottom: FOOTER_H,
            left: 0,
            right: 0,
            maxHeight: 300,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface2)',
            borderTop: '1px solid var(--border)',
            zIndex: 100,
          }}
        >
          {/* Sticky header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px 4px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Token Usage
            </span>
            <button
              onClick={() => setShowTokenDetail(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* Session list — task | model | tokens */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {history.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>No sessions yet</div>
            ) : (
              history.map((r) => {
                const task = agentTaskMap.get(r.agentId) ?? r.agentId.slice(0, 8)
                const totalTok = r.inputTokens + r.outputTokens
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '3px 12px',
                      fontSize: 'var(--fs-xs)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                      {task}
                    </span>
                    <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', flexShrink: 0, minWidth: 38 }}>
                      {shortModel(r.model)}
                    </span>
                    <span style={{ color: 'var(--accent2)', fontFamily: 'var(--mono)', flexShrink: 0, minWidth: 40, textAlign: 'right' }}>
                      {formatTokens(totalTok)}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* Sticky totals footer */}
          {summary && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 12px',
                borderTop: '1px solid var(--border)',
                fontSize: 'var(--fs-xs)',
                flexShrink: 0,
              }}
            >
              <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                {summary.sessionCount} session{summary.sessionCount !== 1 ? 's' : ''}
              </span>
              <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                {formatCost(totalCost)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
