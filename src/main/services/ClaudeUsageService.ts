import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { execFileSync } from 'child_process'
import https from 'https'
import type { UsageLimits } from '@shared/types/tokens'

export type { UsageLimits }

const CACHE_TTL_MS = 10 * 60 * 1000   // 10 min fresh
const STALE_MAX_MS  = 60 * 60 * 1000  // 1h — discard stale after this
const API_TIMEOUT_MS = 8000

function omcCachePath(): string {
  return join(homedir(), '.claude', 'plugins', 'oh-my-claudecode', '.usage-cache.json')
}

function codroxCachePath(): string {
  return join(homedir(), '.claude', 'codrox-usage-cache.json')
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

function writeCacheFile(data: UsageLimits): void {
  try {
    writeFileSync(codroxCachePath(), JSON.stringify({
      timestamp: Date.now(),
      lastSuccessAt: Date.now(),
      data,
      error: false,
      source: 'codrox',
    }))
  } catch { /* ignore write failures */ }
}

function getAccessToken(): string | null {
  // macOS Keychain (primary)
  if (process.platform === 'darwin') {
    for (const account of [undefined as string | undefined]) {
      try {
        const args: string[] = ['find-generic-password', '-s', 'Claude Code-credentials', '-w']
        if (account) args.push('-a', account)
        const result = execFileSync('/usr/bin/security', args, {
          encoding: 'utf-8',
          timeout: 2000,
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()
        if (!result) continue
        const parsed = JSON.parse(result)
        const creds = parsed.claudeAiOauth ?? parsed
        if (creds.accessToken && (!creds.expiresAt || creds.expiresAt > Date.now())) {
          return creds.accessToken as string
        }
      } catch { /* try next */ }
    }
  }
  // File fallback
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
  private inflight: Promise<UsageLimits | null> | null = null

  async getLimits(): Promise<UsageLimits | null> {
    // 1. omc plugin cache (written by oh-my-claudecode if installed)
    const omcFresh = readCacheFile(omcCachePath())
    if (omcFresh) return omcFresh

    // 2. codrox own cache (fresh)
    const codroxFresh = readCacheFile(codroxCachePath())
    if (codroxFresh) return codroxFresh

    // 3. Fetch fresh from Anthropic API (deduplicated)
    if (this.inflight) return this.inflight

    this.inflight = (async () => {
      try {
        const token = getAccessToken()
        if (!token) {
          // Return stale codrox cache as fallback if token missing
          return readCacheFile(codroxCachePath(), true)
        }
        const result = await fetchFromAnthropicApi(token)
        if (result) writeCacheFile(result)
        return result ?? readCacheFile(codroxCachePath(), true)
      } finally {
        this.inflight = null
      }
    })()

    return this.inflight
  }
}

export const claudeUsageService = new ClaudeUsageService()
