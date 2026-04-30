import { create } from 'zustand'
import type { Workspace, Worktree, WorktreeMode } from '@shared/types'

interface WorkspaceState {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  activeWorktreeId: string | null
  // worktrees per workspace (keyed by workspaceId)
  worktreesByWorkspace: Record<string, Worktree[]>
  // mode per worktree path
  modeByWorktree: Record<string, WorktreeMode>
}

interface WorkspaceActions {
  // Initialize: load all workspaces from main process
  loadWorkspaces: () => Promise<void>
  // Add a new workspace via directory picker
  addWorkspace: (path: string) => Promise<Workspace>
  // Remove a workspace
  removeWorkspace: (id: string) => Promise<void>
  // Select active workspace
  setActiveWorkspace: (id: string | null) => void
  // Select active worktree within the active workspace
  setActiveWorktree: (id: string | null) => void
  // Load worktrees for a workspace
  loadWorktrees: (workspaceId: string, workspacePath: string) => Promise<void>
  // Create a new git worktree
  createWorktree: (workspaceId: string, workspacePath: string, branch: string, name: string, baseBranch?: string) => Promise<Worktree>
  // Remove a worktree
  removeWorktree: (workspaceId: string, workspacePath: string, worktreePath: string) => Promise<void>

  setWorktreeMode: (worktreePath: string, mode: WorktreeMode) => void

  // Derived helpers (used by legacy consumers)
  // Returns the path of the active worktree (or active workspace root)
  readonly activeWorktreePath: string | null
  // Legacy: recentWorkspaces alias
  readonly recentWorkspaces: Workspace[]
  // Legacy: openWorkspace (sets active workspace by path)
  openWorkspace: (path: string) => Promise<void>
  loadRecent: () => Promise<void>
  setActiveWorktreeLegacy: (path: string) => void
}

type WorkspaceStore = WorkspaceState & WorkspaceActions

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  activeWorktreeId: null,
  worktreesByWorkspace: {},
  modeByWorktree: {},

  // Derived: active worktree path
  get activeWorktreePath(): string | null {
    const state = get()
    const workspace = state.workspaces.find((w) => w.id === state.activeWorkspaceId)
    if (!workspace) return null
    if (!state.activeWorktreeId) return workspace.path
    const worktrees = state.worktreesByWorkspace[workspace.id] ?? []
    const wt = worktrees.find((w) => w.id === state.activeWorktreeId)
    return wt ? wt.path : workspace.path
  },

  // Derived: recentWorkspaces alias
  get recentWorkspaces(): Workspace[] {
    return get().workspaces
  },

  loadWorkspaces: async () => {
    const workspaces = (await window.api.invoke('workspace:list', undefined)) as Workspace[]
    set({ workspaces })
  },

  addWorkspace: async (path: string) => {
    const workspace = (await window.api.invoke('workspace:add', { path })) as Workspace
    set((state) => ({
      workspaces: [workspace, ...state.workspaces.filter((w) => w.id !== workspace.id)],
      activeWorkspaceId: workspace.id,
      activeWorktreeId: null
    }))
    return workspace
  },

  removeWorkspace: async (id: string) => {
    await window.api.invoke('workspace:remove', { id })
    set((state) => {
      const workspaces = state.workspaces.filter((w) => w.id !== id)
      const activeWorkspaceId = state.activeWorkspaceId === id
        ? (workspaces[0]?.id ?? null)
        : state.activeWorkspaceId
      return { workspaces, activeWorkspaceId, activeWorktreeId: null }
    })
  },

  setActiveWorkspace: (id: string | null) => {
    set({ activeWorkspaceId: id, activeWorktreeId: null })
  },

  setActiveWorktree: (id: string | null) => {
    set({ activeWorktreeId: id })
  },

  loadWorktrees: async (workspaceId: string, workspacePath: string) => {
    const worktrees = (await window.api.invoke('worktree:list', {
      workspaceId,
      workspacePath
    })) as Worktree[]
    set((state) => ({
      worktreesByWorkspace: { ...state.worktreesByWorkspace, [workspaceId]: worktrees }
    }))
  },

  createWorktree: async (workspaceId: string, workspacePath: string, branch: string, name: string, baseBranch?: string) => {
    const wt = (await window.api.invoke('worktree:create', {
      workspaceId,
      workspacePath,
      branch,
      name,
      baseBranch
    })) as Worktree
    set((state) => {
      const existing = state.worktreesByWorkspace[workspaceId] ?? []
      return {
        worktreesByWorkspace: {
          ...state.worktreesByWorkspace,
          [workspaceId]: [...existing, wt]
        },
        activeWorktreeId: wt.id
      }
    })
    return wt
  },

  removeWorktree: async (workspaceId: string, workspacePath: string, worktreePath: string) => {
    await window.api.invoke('worktree:remove', { workspaceId, workspacePath, worktreePath })
    set((state) => {
      const existing = state.worktreesByWorkspace[workspaceId] ?? []
      return {
        worktreesByWorkspace: {
          ...state.worktreesByWorkspace,
          [workspaceId]: existing.filter((w) => w.path !== worktreePath)
        },
        activeWorktreeId:
          state.activeWorktreeId === worktreePath ? null : state.activeWorktreeId
      }
    })
  },

  setWorktreeMode: (worktreePath: string, mode: WorktreeMode) => {
    set((state) => ({
      modeByWorktree: { ...state.modeByWorktree, [worktreePath]: mode }
    }))
  },

  // ---- Legacy shim methods ----

  openWorkspace: async (path: string) => {
    const { addWorkspace } = get()
    await addWorkspace(path)
  },

  loadRecent: async () => {
    const { loadWorkspaces } = get()
    await loadWorkspaces()
  },

  setActiveWorktreeLegacy: (path: string) => {
    // Find workspace by path and activate it
    const { workspaces } = get()
    const ws = workspaces.find((w) => w.path === path)
    if (ws) {
      set({ activeWorkspaceId: ws.id, activeWorktreeId: null })
    }
  }
}))
