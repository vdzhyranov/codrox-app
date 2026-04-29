import { describe, it, expect } from 'vitest'
import { subAgentWatcher } from './SubAgentWatcher'

describe('SubAgentWatcher.hasActiveSession', () => {
  it('returns false for a path with no claude tmp dir', () => {
    // A path that will never have a matching /private/tmp/claude-501/ entry
    expect(subAgentWatcher.hasActiveSession('/nonexistent/path/xyz-no-session-abc')).toBe(false)
  })

  it('returns false for an empty string path', () => {
    expect(subAgentWatcher.hasActiveSession('')).toBe(false)
  })
})
