import { useEffect, useState, useCallback, type JSX } from 'react'
import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import type { TokenSummary, TokenUsageRecord } from '@shared/types/tokens'

// Anthropic pricing per 1M tokens (USD), approximate.
const MODEL_PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-haiku-4-5':           { input: 0.80,  output: 4.00,  cacheWrite: 1.00,  cacheRead: 0.08 },
  'claude-haiku-4-5-20251001':  { input: 0.80,  output: 4.00,  cacheWrite: 1.00,  cacheRead: 0.08 },
  'claude-sonnet-4-5':          { input: 3.00,  output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-sonnet-4-6':          { input: 3.00,  output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-opus-4-7':            { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
}

function defaultPricing() {
  return { input: 3.00, output: 15.00, cacheWrite: 3.75, cacheRead: 0.30 }
}

function getPricing(model: string) {
  // Match on prefix since model IDs include date suffixes
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key) || key.startsWith(model)) return pricing
  }
  return defaultPricing()
}

function calcCost(
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number,
  model: string
): number {
  const p = getPricing(model)
  const M = 1_000_000
  return (
    (inputTokens * p.input +
     outputTokens * p.output +
     cacheCreationTokens * p.cacheWrite +
     cacheReadTokens * p.cacheRead) / M
  )
}

function calcSummaryCost(summary: TokenSummary): number {
  let total = 0
  for (const [model, m] of Object.entries(summary.byModel)) {
    total += calcCost(m.inputTokens, m.outputTokens, m.cacheCreationTokens, m.cacheReadTokens, model)
  }
  return total
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatCost(usd: number): string {
  if (usd < 0.001) return '<$0.001'
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

function shortModel(model: string): string {
  if (model.includes('haiku')) return 'Haiku'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('opus')) return 'Opus'
  return model.split('-')[1] ?? model
}

export function TokenUsagePanel(): JSX.Element {
  const activeWorktreePath = useActiveWorktreePath()
  const [summary, setSummary] = useState<TokenSummary | null>(null)
  const [history, setHistory] = useState<TokenUsageRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    if (!activeWorktreePath) return
    try {
      const [s, h] = await Promise.all([
        window.api.invoke('tokens:getSummary', { workspacePath: activeWorktreePath }) as Promise<TokenSummary>,
        window.api.invoke('tokens:getHistory', { workspacePath: activeWorktreePath }) as Promise<TokenUsageRecord[]>,
      ])
      setSummary(s)
      setHistory(h)
    } catch {
      // no data yet
    }
  }, [activeWorktreePath])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10_000)
    return () => clearInterval(interval)
  }, [load])

  if (!summary || summary.sessionCount === 0) {
    return (
      <div style={{ padding: '6px 12px', fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>
        No data yet
      </div>
    )
  }

  const totalTokens = summary.totalInputTokens + summary.totalOutputTokens +
    summary.totalCacheCreationTokens + summary.totalCacheReadTokens
  const totalCost = calcSummaryCost(summary)
  const models = Object.keys(summary.byModel)

  return (
    <div style={{ padding: '4px 8px 8px' }}>
      {/* Per-model rows */}
      {models.map((model) => {
        const m = summary.byModel[model]
        const cost = calcCost(m.inputTokens, m.outputTokens, m.cacheCreationTokens, m.cacheReadTokens, model)
        return (
          <div
            key={model}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 4px',
              borderRadius: 4,
            }}
          >
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text2)', fontFamily: 'var(--mono)', flex: 1 }}>
              {shortModel(model)}
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              {formatTokens(m.inputTokens)}↓
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              {formatTokens(m.outputTokens)}↑
            </span>
            {m.cacheReadTokens > 0 && (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--blue)', fontFamily: 'var(--mono)' }} title="cache read">
                {formatTokens(m.cacheReadTokens)}⚡
              </span>
            )}
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--green)', fontFamily: 'var(--mono)', minWidth: 44, textAlign: 'right' }}>
              {formatCost(cost)}
            </span>
          </div>
        )
      })}

      {/* Totals row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 4px 2px',
          borderTop: '1px solid var(--border)',
          marginTop: 2,
        }}
      >
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)', flex: 1 }}>
          {summary.sessionCount} session{summary.sessionCount !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent2)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
          {formatTokens(totalTokens)}
        </span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 600, minWidth: 44, textAlign: 'right' }}>
          {formatCost(totalCost)}
        </span>
      </div>

      {/* History toggle */}
      {history.length > 0 && (
        <>
          <div
            onClick={() => setShowHistory((v) => !v)}
            style={{
              padding: '4px 4px 2px',
              fontSize: 'var(--fs-xs)',
              color: 'var(--text3)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
          >
            {showHistory ? '▾ hide history' : `▸ history (${history.length})`}
          </div>

          {showHistory && (
            <div style={{ maxHeight: 160, overflowY: 'auto' }}>
              {history.map((r) => {
                const tokens = r.inputTokens + r.outputTokens + r.cacheCreationTokens + r.cacheReadTokens
                const cost = calcCost(r.inputTokens, r.outputTokens, r.cacheCreationTokens, r.cacheReadTokens, r.model)
                const date = new Date(r.startedAt)
                const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '2px 4px',
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--text3)',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--mono)', opacity: 0.6 }}>{timeStr}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shortModel(r.model)}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)' }}>{formatTokens(tokens)}</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', minWidth: 40, textAlign: 'right' }}>
                      {formatCost(cost)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
