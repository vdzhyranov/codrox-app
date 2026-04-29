export interface TokenUsageRecord {
  id: string
  agentId: string
  gitBranch: string
  model: string
  startedAt: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

export interface TokenSummary {
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
  sessionCount: number
  byModel: Record<string, {
    inputTokens: number
    outputTokens: number
    cacheCreationTokens: number
    cacheReadTokens: number
  }>
}
