import * as fs from 'fs'
import * as path from 'path'

export interface DetectedAgent {
  id: string
  taskDescription: string
  status: 'running' | 'done'
  lastActivity: number
  toolCalls: number
  textMessages: number
  filePath: string
}

interface JsonlLine {
  type?: string
  agentId?: string
  message?: {
    content?: string | Array<{ type: string; text?: string; name?: string; input?: unknown }>
  }
}

function parseJsonlFile(filePath: string): DetectedAgent | null {
  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }

  const lines = content.trim().split('\n').filter(Boolean)
  if (lines.length === 0) return null

  let agentId = ''
  let taskDescription = ''
  let toolCalls = 0
  let textMessages = 0
  let lastActivity = 0

  for (const line of lines) {
    let parsed: JsonlLine
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }

    if (parsed.agentId) agentId = parsed.agentId

    if (parsed.type === 'user' && !taskDescription) {
      const content = parsed.message?.content
      if (typeof content === 'string') {
        taskDescription = content.slice(0, 100)
      } else if (Array.isArray(content)) {
        const textBlock = content.find((b) => b.type === 'text')
        if (textBlock && textBlock.text) {
          taskDescription = textBlock.text.slice(0, 100)
        }
      }
    }

    if (parsed.type === 'assistant') {
      const content = parsed.message?.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use') toolCalls++
          if (block.type === 'text') textMessages++
        }
      }
    }
  }

  // Use file modification time for lastActivity
  try {
    const stat = fs.statSync(filePath)
    lastActivity = stat.mtimeMs
  } catch {
    lastActivity = Date.now()
  }

  // Derive id from filename if not present in content
  if (!agentId) {
    const base = path.basename(filePath, '.jsonl')
    agentId = base.startsWith('agent-') ? base : base
  }

  return {
    id: agentId || path.basename(filePath, '.jsonl'),
    taskDescription: taskDescription || '(no task)',
    status: 'running', // will be updated by caller
    lastActivity,
    toolCalls,
    textMessages,
    filePath,
  }
}

class AgentWatcher {
  private watchSubscription: fs.FSWatcher | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private watchedDir: string | null = null
  private lastSeenAgents: Map<string, DetectedAgent> = new Map()
  private lastSeenModTimes: Map<string, number> = new Map()

  async watch(
    sessionTasksDir: string,
    callback: (agents: DetectedAgent[]) => void
  ): Promise<void> {
    await this.unwatch()
    this.watchedDir = sessionTasksDir
    this.lastSeenAgents.clear()
    this.lastSeenModTimes.clear()

    const scan = (): void => {
      const agents = this.scanDir(sessionTasksDir)
      // Update running/done status
      const now = Date.now()
      for (const agent of agents) {
        const prev = this.lastSeenAgents.get(agent.id)
        const prevMod = this.lastSeenModTimes.get(agent.id) ?? 0
        if (agent.lastActivity === prevMod && prev && now - agent.lastActivity > 10_000) {
          agent.status = 'done'
        } else {
          agent.status = 'running'
        }
        this.lastSeenAgents.set(agent.id, agent)
        this.lastSeenModTimes.set(agent.id, agent.lastActivity)
      }
      callback(agents)
    }

    // Watch for new files
    try {
      if (!fs.existsSync(sessionTasksDir)) {
        fs.mkdirSync(sessionTasksDir, { recursive: true })
      }
      this.watchSubscription = fs.watch(sessionTasksDir, () => {
        scan()
      })
    } catch {
      // Directory may not exist yet; poll will handle it
    }

    // Poll every 3 seconds for content updates
    this.pollTimer = setInterval(scan, 3000)
    // Initial scan
    scan()
  }

  private scanDir(dir: string): DetectedAgent[] {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return []
    }

    const agents: DetectedAgent[] = []
    for (const entry of entries) {
      if (!entry.name.endsWith('.output') && !entry.name.endsWith('.jsonl')) continue
      const fullPath = path.join(dir, entry.name)
      // Resolve symlinks
      let realPath = fullPath
      try {
        realPath = fs.realpathSync(fullPath)
      } catch {
        // use fullPath
      }
      const agent = parseJsonlFile(realPath)
      if (agent) {
        agent.filePath = realPath
        agents.push(agent)
      }
    }
    return agents
  }

  parseAgentFile(filePath: string): DetectedAgent | null {
    return parseJsonlFile(filePath)
  }

  async unwatch(): Promise<void> {
    if (this.watchSubscription) {
      this.watchSubscription.close()
      this.watchSubscription = null
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.watchedDir = null
    this.lastSeenAgents.clear()
    this.lastSeenModTimes.clear()
  }
}

export const agentWatcher = new AgentWatcher()
