import { existsSync, readFileSync, statSync } from 'fs'
import { graphService } from './graph/GraphService'
import type { TokenUsageRecord } from '@shared/types/tokens'

const MAX_TRANSCRIPT_BYTES = 4 * 1024 * 1024

interface UsageBlock {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

interface TranscriptLine {
  type?: string
  agentId?: string
  gitBranch?: string
  timestamp?: string
  message?: {
    model?: string
    usage?: UsageBlock
  }
}

function readTranscript(outputPath: string): string | null {
  try {
    const stat = statSync(outputPath)
    if (!stat.isFile() || stat.size === 0) return null
    if (stat.size > MAX_TRANSCRIPT_BYTES) {
      const { openSync, readSync, closeSync } = require('fs') as typeof import('fs')
      const buf = Buffer.allocUnsafe(MAX_TRANSCRIPT_BYTES)
      const fd = openSync(outputPath, 'r')
      try {
        const n = readSync(fd, buf, 0, MAX_TRANSCRIPT_BYTES, 0)
        return buf.slice(0, n).toString('utf-8')
      } finally {
        closeSync(fd)
      }
    }
    return readFileSync(outputPath, 'utf-8')
  } catch {
    return null
  }
}

// Aggregate per (agentId, gitBranch, model) across all assistant lines in a transcript.
function parseTranscript(text: string): Map<string, TokenUsageRecord> {
  // key = `${agentId}:${model}`
  const byKey = new Map<string, TokenUsageRecord>()
  let firstStartedAt = Date.now()
  let gotTimestamp = false

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let parsed: TranscriptLine
    try {
      parsed = JSON.parse(trimmed) as TranscriptLine
    } catch {
      continue
    }

    if (parsed.type !== 'assistant') continue
    const usage = parsed.message?.usage
    if (!usage) continue

    const agentId = parsed.agentId ?? 'unknown'
    const gitBranch = parsed.gitBranch ?? 'unknown'
    const model = parsed.message?.model ?? 'unknown'

    if (!gotTimestamp && parsed.timestamp) {
      firstStartedAt = new Date(parsed.timestamp).getTime() || firstStartedAt
      gotTimestamp = true
    }

    const key = `${agentId}:${model}`
    const existing = byKey.get(key)
    if (existing) {
      existing.inputTokens          += usage.input_tokens ?? 0
      existing.outputTokens         += usage.output_tokens ?? 0
      existing.cacheCreationTokens  += usage.cache_creation_input_tokens ?? 0
      existing.cacheReadTokens      += usage.cache_read_input_tokens ?? 0
    } else {
      byKey.set(key, {
        id: key,
        agentId,
        gitBranch,
        model,
        startedAt: firstStartedAt,
        inputTokens:         usage.input_tokens ?? 0,
        outputTokens:        usage.output_tokens ?? 0,
        cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens:     usage.cache_read_input_tokens ?? 0,
      })
    }
  }

  return byKey
}

class TokenUsageService {
  /**
   * Parse a completed agent transcript and store usage in the workspace's knowledge.db.
   * Safe to call multiple times — skips if agentId is already indexed.
   */
  indexAgent(workspacePath: string, agentId: string, outputPath: string): void {
    if (!existsSync(outputPath)) return
    if (graphService.hasTokenUsage(workspacePath, agentId)) return

    const text = readTranscript(outputPath)
    if (!text) return

    const records = parseTranscript(text)
    for (const record of records.values()) {
      graphService.recordTokenUsage(workspacePath, record)
    }
  }

  /**
   * Backfill token usage for all known agents in a workspace.
   * Called on workspace open so historical sessions are captured.
   */
  backfill(workspacePath: string, agents: Array<{ id: string; outputPath: string }>): void {
    for (const agent of agents) {
      this.indexAgent(workspacePath, agent.id, agent.outputPath)
    }
  }
}

export const tokenUsageService = new TokenUsageService()
