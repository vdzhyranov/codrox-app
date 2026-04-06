import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

export interface SubAgentInfo {
  id: string
  task: string
}

class SubAgentWatcher {
  private watching = false
  private knownAgents = new Set<string>()
  private pollInterval: NodeJS.Timeout | null = null

  start(workspacePath: string, callback: (newAgent: SubAgentInfo) => void): void {
    this.stop()
    this.watching = true
    this.knownAgents.clear()

    const projectKey = workspacePath.replace(/\//g, '-')
    const baseDir = `/private/tmp/claude-501/${projectKey}`

    // Seed known agents with all existing files so we only detect NEW agents
    const sessionDir = this.findMostRecentSessionDir(baseDir)
    if (sessionDir) {
      const tasksDir = join(sessionDir, 'tasks')
      if (existsSync(tasksDir)) {
        try {
          for (const entry of readdirSync(tasksDir)) {
            if (entry.endsWith('.output')) {
              this.knownAgents.add(entry.replace(/\.output$/, ''))
            }
          }
        } catch {
          // ignore
        }
      }
    }

    const poll = (): void => {
      if (!this.watching) return

      const currentSessionDir = this.findMostRecentSessionDir(baseDir)
      if (!currentSessionDir) return

      const tasksDir = join(currentSessionDir, 'tasks')
      if (!existsSync(tasksDir)) return

      let entries: string[]
      try {
        entries = readdirSync(tasksDir)
      } catch {
        return
      }

      for (const entry of entries) {
        if (!entry.endsWith('.output')) continue
        const agentId = entry.replace(/\.output$/, '')
        if (this.knownAgents.has(agentId)) continue

        this.knownAgents.add(agentId)

        const filePath = join(tasksDir, entry)
        const task = this.extractTask(filePath)
        callback({ id: agentId, task })
      }
    }

    this.pollInterval = setInterval(poll, 2000)
  }

  stop(): void {
    this.watching = false
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    this.knownAgents.clear()
  }

  private findMostRecentSessionDir(baseDir: string): string | null {
    if (!existsSync(baseDir)) return null

    let entries: string[]
    try {
      entries = readdirSync(baseDir)
    } catch {
      return null
    }

    // Session dirs are UUID-like — pick the most recently modified
    let mostRecent: string | null = null
    let mostRecentMtime = 0

    for (const entry of entries) {
      const fullPath = join(baseDir, entry)
      try {
        const { statSync } = require('fs') as typeof import('fs')
        const stat = statSync(fullPath)
        if (stat.isDirectory() && stat.mtimeMs > mostRecentMtime) {
          mostRecentMtime = stat.mtimeMs
          mostRecent = fullPath
        }
      } catch {
        // ignore
      }
    }

    return mostRecent
  }

  private extractTask(filePath: string): string {
    try {
      if (!existsSync(filePath)) return 'Agent task'
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n').filter((l) => l.trim())
      for (const line of lines.slice(0, 20)) {
        try {
          const parsed = JSON.parse(line) as Record<string, unknown>
          if (parsed.type === 'user') {
            const msg = parsed.message as Record<string, unknown> | undefined
            const content = msg?.content
            if (typeof content === 'string') {
              return content.slice(0, 60).trim() || 'Agent task'
            }
            if (Array.isArray(content)) {
              for (const part of content) {
                const p = part as Record<string, unknown>
                if (p.type === 'text' && typeof p.text === 'string') {
                  return p.text.slice(0, 60).trim() || 'Agent task'
                }
              }
            }
          }
        } catch {
          // not valid JSON, skip
        }
      }
    } catch {
      // ignore
    }
    return 'Agent task'
  }
}

export const subAgentWatcher = new SubAgentWatcher()
