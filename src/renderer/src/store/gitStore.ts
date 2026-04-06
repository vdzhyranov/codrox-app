import { create } from 'zustand'
import type { GitFileStatus } from '@shared/types'

interface GitState {
  statusByWorktree: Record<string, GitFileStatus[]>
}

interface GitActions {
  setStatus: (worktreeId: string, statuses: GitFileStatus[]) => void
  getStatus: (worktreeId: string) => GitFileStatus[]
}

type GitStore = GitState & GitActions

export const useGitStore = create<GitStore>((set, get) => ({
  statusByWorktree: {},

  setStatus: (worktreeId: string, statuses: GitFileStatus[]) => {
    set((state) => ({
      statusByWorktree: { ...state.statusByWorktree, [worktreeId]: statuses }
    }))
  },

  getStatus: (worktreeId: string) => {
    return get().statusByWorktree[worktreeId] ?? []
  }
}))
