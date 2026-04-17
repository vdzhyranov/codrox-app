import { create } from 'zustand'
import type {
  LinearUser,
  LinearTeam,
  LinearTask,
  CreateTaskInput,
  WorktreeLinearLink
} from '@shared/types'

interface LinearState {
  isAuthenticated: boolean
  user: LinearUser | null
  tasks: LinearTask[]
  teams: LinearTeam[]
  isLoading: boolean
  error: string | null
  lastFetched: number | null
  selectedTeamId: string | null
  draggedTaskId: string | null
  linkedTasks: Record<string, WorktreeLinearLink>
}

interface LinearActions {
  checkAuth: () => Promise<void>
  authenticate: (apiKey: string) => Promise<void>
  logout: () => Promise<void>
  fetchTasks: (teamId?: string) => Promise<void>
  fetchTeams: () => Promise<void>
  createTask: (input: CreateTaskInput) => Promise<LinearTask>
  setDraggedTask: (taskId: string | null) => void
  setSelectedTeam: (teamId: string | null) => void
  linkWorktree: (worktreePath: string, taskId: string, identifier: string) => Promise<void>
  loadLinkedTask: (worktreePath: string) => Promise<void>
}

type LinearStore = LinearState & LinearActions

export const useLinearStore = create<LinearStore>((set, get) => ({
  isAuthenticated: false,
  user: null,
  tasks: [],
  teams: [],
  isLoading: false,
  error: null,
  lastFetched: null,
  selectedTeamId: null,
  draggedTaskId: null,
  linkedTasks: {},

  checkAuth: async () => {
    try {
      const status = (await window.api.invoke('linear:status', undefined)) as {
        isAuthenticated: boolean
        user: LinearUser | null
      }
      set({ isAuthenticated: status.isAuthenticated, user: status.user })
      if (status.isAuthenticated) {
        get().fetchTeams().catch(() => {})
        get().fetchTasks().catch(() => {})
      }
    } catch {
      set({ isAuthenticated: false, user: null })
    }
  },

  authenticate: async (apiKey: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = (await window.api.invoke('linear:auth', { apiKey })) as {
        success: boolean
        user: LinearUser | null
      }
      if (result.success) {
        set({ isAuthenticated: true, user: result.user, isLoading: false })
        get().fetchTeams().catch(() => {})
        get().fetchTasks().catch(() => {})
      } else {
        set({ isLoading: false, error: 'Authentication failed' })
      }
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Authentication failed' })
    }
  },

  logout: async () => {
    await window.api.invoke('linear:logout', undefined)
    set({
      isAuthenticated: false,
      user: null,
      tasks: [],
      teams: [],
      selectedTeamId: null,
      lastFetched: null,
      error: null
    })
  },

  fetchTasks: async (teamId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const id = teamId ?? get().selectedTeamId
      const tasks = (await window.api.invoke('linear:fetchTasks', id ? { teamId: id } : undefined)) as LinearTask[]
      set({ tasks, isLoading: false, lastFetched: Date.now() })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to fetch tasks' })
    }
  },

  fetchTeams: async () => {
    try {
      const teams = (await window.api.invoke('linear:getTeams', undefined)) as LinearTeam[]
      set({ teams })
    } catch {
      // non-critical
    }
  },

  createTask: async (input: CreateTaskInput) => {
    const task = (await window.api.invoke('linear:createTask', input)) as LinearTask
    set((state) => ({ tasks: [task, ...state.tasks] }))
    return task
  },

  setDraggedTask: (taskId: string | null) => {
    set({ draggedTaskId: taskId })
  },

  setSelectedTeam: (teamId: string | null) => {
    set({ selectedTeamId: teamId })
    get().fetchTasks(teamId ?? undefined).catch(() => {})
  },

  linkWorktree: async (worktreePath: string, taskId: string, identifier: string) => {
    await window.api.invoke('linear:linkWorktree', { worktreePath, taskId, taskIdentifier: identifier })
    set((state) => ({
      linkedTasks: {
        ...state.linkedTasks,
        [worktreePath]: { worktreePath, taskId, taskIdentifier: identifier }
      }
    }))
  },

  loadLinkedTask: async (worktreePath: string) => {
    const link = (await window.api.invoke('linear:getLinkedTask', { worktreePath })) as WorktreeLinearLink | null
    if (link) {
      set((state) => ({
        linkedTasks: { ...state.linkedTasks, [worktreePath]: link }
      }))
    }
  }
}))
