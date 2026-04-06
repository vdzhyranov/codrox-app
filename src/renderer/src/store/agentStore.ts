import { create } from 'zustand'

export type AgentStatus = 'running' | 'waiting' | 'done' | 'error'

export interface Agent {
  id: string
  worktreePath: string
  name: string
  task: string
  status: AgentStatus
  ptyId: string
  startedAt: number
}

export interface DetectedAgent {
  id: string
  taskDescription: string
  status: 'running' | 'done'
  lastActivity: number
  toolCalls: number
  textMessages: number
  filePath: string
}

interface AgentState {
  agents: Record<string, Agent>
  activeAgentId: string | null
  detectedAgents: DetectedAgent[]
  watchingSessionDir: string | null
  selectedDetectedAgentId: string | null
}

interface AgentActions {
  createAgent: (worktreePath: string, task: string) => Agent
  removeAgent: (id: string) => void
  setActiveAgent: (id: string) => void
  setAgentStatus: (id: string, status: AgentStatus) => void
  getAgentsByWorktree: (worktreePath: string) => Agent[]
  setDetectedAgents: (agents: DetectedAgent[]) => void
  startWatching: (workspacePath: string) => Promise<void>
  stopWatching: () => void
  setSelectedDetectedAgent: (id: string | null) => void
}

type AgentStore = AgentState & AgentActions

const GREEK_LETTERS = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π']

function getNextName(agents: Record<string, Agent>, worktreePath: string): string {
  const existing = Object.values(agents).filter((a) => a.worktreePath === worktreePath)
  const usedLetters = new Set(existing.map((a) => a.name.split(' ')[1]))
  const letter = GREEK_LETTERS.find((l) => !usedLetters.has(l)) ?? `${existing.length + 1}`
  return `Agent ${letter}`
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: {},
  activeAgentId: null,
  detectedAgents: [],
  watchingSessionDir: null,
  selectedDetectedAgentId: null,

  createAgent: (worktreePath: string, task: string): Agent => {
    const state = get()
    const name = getNextName(state.agents, worktreePath)
    const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const ptyId = `claude-${id}`
    const agent: Agent = {
      id,
      worktreePath,
      name,
      task,
      status: 'running',
      ptyId,
      startedAt: Date.now(),
    }
    set((s) => ({
      agents: { ...s.agents, [id]: agent },
      activeAgentId: id,
    }))
    return agent
  },

  removeAgent: (id: string) => {
    set((s) => {
      const agents = { ...s.agents }
      delete agents[id]
      const keys = Object.keys(agents)
      const activeAgentId =
        s.activeAgentId === id ? (keys[keys.length - 1] ?? null) : s.activeAgentId
      return { agents, activeAgentId }
    })
  },

  setActiveAgent: (id: string) => {
    set({ activeAgentId: id })
  },

  setAgentStatus: (id: string, status: AgentStatus) => {
    set((s) => {
      const agent = s.agents[id]
      if (!agent) return s
      return { agents: { ...s.agents, [id]: { ...agent, status } } }
    })
  },

  getAgentsByWorktree: (worktreePath: string): Agent[] => {
    return Object.values(get().agents).filter((a) => a.worktreePath === worktreePath)
  },

  setDetectedAgents: (agents: DetectedAgent[]) => {
    set({ detectedAgents: agents })
  },

  startWatching: async (workspacePath: string): Promise<void> => {
    const result = await window.api.invoke('agents:watch', { workspacePath }) as { success: boolean; tasksDir?: string }
    if (result.success && result.tasksDir) {
      set({ watchingSessionDir: result.tasksDir })
    }
    // Listen for updates from main process
    window.api.on('agents:detected', (...args: unknown[]) => {
      const agents = args[0] as DetectedAgent[]
      set({ detectedAgents: agents })
    })
  },

  stopWatching: () => {
    window.api.invoke('agents:unwatch').catch(() => {})
    set({ watchingSessionDir: null, detectedAgents: [] })
  },

  setSelectedDetectedAgent: (id: string | null) => {
    set({ selectedDetectedAgentId: id })
  },
}))
