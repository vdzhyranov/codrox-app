import { create } from 'zustand'

export interface AgentInfo {
  id: string
  name: string
  type: string
  task: string
  status: 'running' | 'completed' | 'idle'
  sessionName: string
  startedAt: string | null
}

interface AgentStore {
  agents: AgentInfo[]
  setAgents: (agents: AgentInfo[]) => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  setAgents: (agents) => set({ agents }),
}))
