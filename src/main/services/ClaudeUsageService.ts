import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import https from 'https'
import type { UsageLimits } from '@shared/types/tokens'

export type { UsageLimits }

const CACHE_TTL_MS = 10 * 60 * 1000   // 10 min fresh
const STALE_MAX_MS  = 60 * 60 * 1000  // 1h — discard stale after this
const API_TIMEOUT_MS = 8000

function omcCachePath(): string {
  return join(homedir(), '.claude', 'plugins', 'oh-my-claudecode', '.usage-cache.json')
}

function codroxCachePath(workspaceId?: string): string {
  const suffix = workspaceId ? `-${workspaceId}` : ''
  return join(homedir(), '.claude', `codrox-usage-cache${suffix}.json`)
}

function readCacheFile(path: string, allowStale = false): UsageLimits | null {
  try {
    if (!existsSync(path)) return null
    const raw = JSON.parse(readFileSync(path, 'utf-8'))
    if (!raw.data || raw.error) return null
    const age = Date.now() - (raw.lastSuccessAt ?? raw.timestamp ?? 0)
    if (!allowStale && age > CACHE_TTL_MS) return null
    if (allowStale && age > STALE_MAX_MS) return null
    return {
      fiveHourPercent: raw.data.fiveHourPercent ?? null,
      weeklyPercent: raw.data.weeklyPercent ?? null,
      fiveHourResetsAt: raw.data.fiveHourResetsAt ?? null,
      weeklyResetsAt: raw.data.weeklyResetsAt ?? null,
      stale: age > CACHE_TTL_MS,
    }
  } catch {
    return null
  }
}

function writeCacheFile(data: UsageLimits, workspaceId?: string): void {
  try {
    writeFileSync(codroxCachePath(workspaceId), JSON.stringify({
      timestamp: Date.now(),
      lastSuccessAt: Date.now(),
      data,
      error: false,
      source: 'codrox',
    }))
  } catch { /* ignore write failures */ }
}

// Claude Code stores per-workspace creds in the Keychain under
// "Claude Code-credentials-{sha256(CLAUDE_CONFIG_DIR).slice(0,8)}"
function keychainSuffix(claudeDir: string): string {
  return createHash('sha256').update(claudeDir).digest('hex').slice(0, 8)
}

function readKeychainCred(service: string): string | null {
  try {
    const result = execFileSync('/usr/bin/security', ['find-generic-password', '-s', service, '-w'], {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    if (!result) return null
    const parsed = JSON.parse(result)
    const creds = parsed.claudeAiOauth ?? parsed
    if (creds.accessToken && (!creds.expiresAt || creds.expiresAt > Date.now())) {
      return creds.accessToken as string
    }
  } catch { /* not found or invalid */ }
  return null
}

function getAccessToken(workspaceClaudeDir?: string): string | null {
  if (process.platform === 'darwin') {
    // Try workspace-specific Keychain entry first (different account per workspace)
    if (workspaceClaudeDir) {
      const token = readKeychainCred(`Claude Code-credentials-${keychainSuffix(workspaceClaudeDir)}`)
      if (token) return token
    }
    // Fall back to global Keychain entry (workspace using default account)
    const globalToken = readKeychainCred('Claude Code-credentials')
    if (globalToken) return globalToken
  }
  // Non-macOS or Keychain unavailable: try workspace-specific .credentials.json
  if (workspaceClaudeDir) {
    try {
      const credPath = join(workspaceClaudeDir, '.credentials.json')
      if (existsSync(credPath)) {
        const parsed = JSON.parse(readFileSync(credPath, 'utf-8'))
        const creds = parsed.claudeAiOauth ?? parsed
        if (creds.accessToken && (!creds.expiresAt || creds.expiresAt > Date.now())) {
          return creds.accessToken as string
        }
      }
    } catch { /* fall through */ }
  }
  // Global file fallback
  try {
    const credPath = join(homedir(), '.claude', '.credentials.json')
    if (!existsSync(credPath)) return null
    const parsed = JSON.parse(readFileSync(credPath, 'utf-8'))
    const creds = parsed.claudeAiOauth ?? parsed
    return (creds.accessToken as string) ?? null
  } catch {
    return null
  }
}

function fetchFromAnthropicApi(accessToken: string): Promise<UsageLimits | null> {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/api/oauth/usage',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Type': 'application/json',
      },
      timeout: API_TIMEOUT_MS,
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) { resolve(null); return }
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          const fiveHour = (json.five_hour as Record<string, number> | undefined)?.utilization
          const sevenDay = (json.seven_day as Record<string, unknown> | undefined)?.utilization as number | undefined
          if (fiveHour == null && sevenDay == null) { resolve(null); return }
          resolve({
            fiveHourPercent: fiveHour != null ? Math.round(fiveHour) : null,
            weeklyPercent: sevenDay != null ? Math.round(sevenDay) : null,
            fiveHourResetsAt: ((json.five_hour as Record<string, string> | undefined)?.resets_at) ?? null,
            weeklyResetsAt: ((json.seven_day as Record<string, string> | undefined)?.resets_at) ?? null,
          })
        } catch {
          resolve(null)
        }
      })
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
    req.end()
  })
}

class ClaudeUsageService {
  private inflight = new Map<string, Promise<UsageLimits | null>>()

  async getLimits(workspaceId?: string, workspaceClaudeDir?: string): Promise<UsageLimits | null> {
    const cacheKey = workspaceId ?? '__global__'
    const hasWorkspaceDir = !!workspaceClaudeDir

    // 1. omc plugin cache — only for global (shared) account; skip if workspace has its own creds
    if (!hasWorkspaceDir) {
      const omcFresh = readCacheFile(omcCachePath())
      if (omcFresh) return omcFresh
    }

    // 2. codrox own cache (per-workspace when workspaceId is present)
    const codroxFresh = readCacheFile(codroxCachePath(workspaceId))
    if (codroxFresh) return codroxFresh

    // 3. Fetch fresh from Anthropic API (deduplicated per workspace)
    const existing = this.inflight.get(cacheKey)
    if (existing) return existing

    const promise = (async () => {
      try {
        const token = getAccessToken(workspaceClaudeDir)
        if (!token) {
          return readCacheFile(codroxCachePath(workspaceId), true)
        }
        const result = await fetchFromAnthropicApi(token)
        if (result) writeCacheFile(result, workspaceId)
        return result ?? readCacheFile(codroxCachePath(workspaceId), true)
      } finally {
        this.inflight.delete(cacheKey)
      }
    })()

    this.inflight.set(cacheKey, promise)
    return promise
  }
}

export const claudeUsageService = new ClaudeUsageService()
