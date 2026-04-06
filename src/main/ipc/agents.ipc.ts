import { IpcMain, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { agentWatcher } from '../services/AgentWatcher'
import type { DetectedAgent } from '../services/AgentWatcher'

interface JsonlLine {
  type?: string
  agentId?: string
  message?: {
    content?: string | Array<{ type: string; text?: string; name?: string; input?: unknown }>
  }
}

export interface AgentLogMessage {
  type: 'task' | 'tool_use' | 'text' | 'unknown'
  content: string
  toolName?: string
  input?: unknown
}

function getClaudeUid(): number {
  // On macOS, Claude runs as the logged-in user (uid 501 is common default)
  return 501
}

function workspacePathToKey(workspacePath: string): string {
  // /Applications/Development/codrox-app → -Applications-Development-codrox-app
  return workspacePath.replace(/\//g, '-')
}

function findSessionTasksDir(workspacePath: string): string | null {
  const uid = getClaudeUid()
  const claudeTmpBase = `/private/tmp/claude-${uid}`

  let baseEntries: string[]
  try {
    baseEntries = fs.readdirSync(claudeTmpBase)
  } catch {
    return null
  }

  const key = workspacePathToKey(workspacePath)
  // The directory under claudeTmpBase is named after the project path with leading dash
  const projectDir = path.join(claudeTmpBase, key)

  let sessionEntries: string[]
  try {
    sessionEntries = fs.readdirSync(projectDir)
  } catch {
    // Try scanning for a matching dir
    for (const entry of baseEntries) {
      if (entry.includes(key.slice(1))) {
        const candidate = path.join(claudeTmpBase, entry)
        try {
          sessionEntries = fs.readdirSync(candidate)
          // Found it — use this as projectDir
          return findMostRecentTasksDir(path.join(claudeTmpBase, entry))
        } catch {
          continue
        }
      }
    }
    return null
  }

  return findMostRecentTasksDir(projectDir)
}

function findMostRecentTasksDir(projectDir: string): string | null {
  let sessionEntries: string[]
  try {
    sessionEntries = fs.readdirSync(projectDir)
  } catch {
    return null
  }

  // Sessions are directories; find most recently modified
  let bestTime = 0
  let bestSession = ''

  for (const entry of sessionEntries) {
    const full = path.join(projectDir, entry)
    try {
      const stat = fs.statSync(full)
      if (stat.isDirectory() && stat.mtimeMs > bestTime) {
        bestTime = stat.mtimeMs
        bestSession = full
      }
    } catch {
      continue
    }
  }

  if (!bestSession) return null

  const tasksDir = path.join(bestSession, 'tasks')
  // Return tasks dir even if it doesn't exist yet (watcher will create it)
  return tasksDir
}

function parseAgentLog(filePath: string): AgentLogMessage[] {
  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return []
  }

  const lines = content.trim().split('\n').filter(Boolean)
  const messages: AgentLogMessage[] = []

  for (const line of lines) {
    let parsed: JsonlLine
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }

    if (parsed.type === 'user') {
      const c = parsed.message?.content
      let text = ''
      if (typeof c === 'string') {
        text = c
      } else if (Array.isArray(c)) {
        const tb = c.find((b) => b.type === 'text')
        text = tb?.text ?? ''
      }
      if (text) messages.push({ type: 'task', content: text })
    } else if (parsed.type === 'assistant') {
      const c = parsed.message?.content
      if (Array.isArray(c)) {
        for (const block of c) {
          if (block.type === 'tool_use') {
            let inputSummary = ''
            if (block.input && typeof block.input === 'object') {
              const inp = block.input as Record<string, unknown>
              // Show file_path or command as the primary label
              inputSummary =
                (inp['file_path'] as string) ||
                (inp['command'] as string) ||
                (inp['description'] as string) ||
                ''
            }
            messages.push({
              type: 'tool_use',
              content: inputSummary,
              toolName: block.name ?? '',
              input: block.input,
            })
          } else if (block.type === 'text' && block.text) {
            messages.push({ type: 'text', content: block.text })
          }
        }
      }
    }
  }

  return messages
}

export function register(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
  // Start watching for sub-agents in a session's tasks directory
  ipcMain.handle('agents:watch', async (_event, payload: { workspacePath: string }) => {
    const tasksDir = findSessionTasksDir(payload.workspacePath)
    if (!tasksDir) {
      return { success: false, error: 'No Claude session found for this workspace' }
    }

    await agentWatcher.watch(tasksDir, (agents: DetectedAgent[]) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agents:detected', agents)
      }
    })

    return { success: true, tasksDir }
  })

  // Stop watching
  ipcMain.handle('agents:unwatch', async () => {
    await agentWatcher.unwatch()
    return { success: true }
  })

  // Read and parse a specific agent's JSONL log
  ipcMain.handle('agents:readLog', (_event, payload: { filePath: string }) => {
    return parseAgentLog(payload.filePath)
  })

  // Find the active Claude session's tasks directory for a workspace
  ipcMain.handle('agents:getSessionDir', (_event, payload: { workspacePath: string }) => {
    return findSessionTasksDir(payload.workspacePath)
  })
}
