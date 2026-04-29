import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

export interface SubAgentInfo {
  id: string
  task: string
}

export interface AgentListEntry {
  id: string
  task: string
  status: 'running' | 'completed'
  startedAt: number
  fileSize: number
  /** Absolute path to the agent's .output transcript on disk. */
  outputPath: string
}

class SubAgentWatcher {
  private watching = false
  private knownAgents = new Set<string>()
  private pollInterval: NodeJS.Timeout | null = null

  start(workspacePath: string, callback: (newAgent: SubAgentInfo) => void): void {
    this.stop()
    this.watching = true
    this.knownAgents.clear()

    // Claude Code's sub-agent task transcripts live under /private/tmp/claude-<uid>/.
    // The path is uid-scoped, not HOME-scoped, so the per-workspace fake $HOME
    // injected by ClaudeEnvManager does not affect this lookup. Project key is
    // derived from cwd (the workspace path), which is also stable.
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

  listAgents(workspacePath: string): AgentListEntry[] {
    const projectKey = workspacePath.replace(/\//g, '-')
    const baseDir = `/private/tmp/claude-501/${projectKey}`
    const agents: AgentListEntry[] = []

    // Scan ALL session dirs, not just most recent
    if (!existsSync(baseDir)) return agents

    let sessionDirs: string[]
    try {
      sessionDirs = readdirSync(baseDir)
        .map((d) => join(baseDir, d))
        .filter((d) => { try { return statSync(d).isDirectory() } catch { return false } })
    } catch {
      return agents
    }

    const now = Date.now()
    const ONE_HOUR = 60 * 60 * 1000

    for (const sessionDir of sessionDirs) {
      const tasksDir = join(sessionDir, 'tasks')
      if (!existsSync(tasksDir)) continue

      let entries: string[]
      try {
        entries = readdirSync(tasksDir)
      } catch {
        continue
      }

      for (const entry of entries) {
        if (!entry.endsWith('.output')) continue
        const filePath = join(tasksDir, entry)
        const agentId = entry.replace(/\.output$/, '')

        try {
          const stat = statSync(filePath)
          const age = now - stat.mtimeMs
          // Only show agents from the last hour
          if (age > ONE_HOUR) continue

          const task = this.extractTask(filePath)
          // If file was modified in the last 30 seconds, consider it running
          const isRunning = age < 30000 && stat.size > 0

          agents.push({
            id: agentId,
            task,
            status: isRunning ? 'running' : 'completed',
            startedAt: stat.birthtimeMs || stat.ctimeMs,
            fileSize: stat.size,
            outputPath: filePath,
          })
        } catch {
          // ignore
        }
      }
    }

    // Sort by most recently started first
    agents.sort((a, b) => b.startedAt - a.startedAt)
    return agents
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
