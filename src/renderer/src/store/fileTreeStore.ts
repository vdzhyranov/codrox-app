import { create } from 'zustand'
import type { FileTreeNode } from '@shared/types'

interface FileTreeState {
  treeByWorktree: Record<string, FileTreeNode | null>
  expandedPaths: Record<string, Set<string>>
  selectedFilePath: string | null
  openFiles: string[]
  activeTab: 'work' | string  // 'work' or a file path
}

interface FileTreeActions {
  setTree: (worktreeId: string, root: FileTreeNode) => void
  toggleExpand: (worktreeId: string, path: string) => void
  isExpanded: (worktreeId: string, path: string) => boolean
  setSelectedFile: (path: string | null) => void
  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveTab: (tab: 'work' | string) => void
}

type FileTreeStore = FileTreeState & FileTreeActions

export const useFileTreeStore = create<FileTreeStore>((set, get) => ({
  treeByWorktree: {},
  expandedPaths: {},
  selectedFilePath: null,
  openFiles: [],
  activeTab: 'work',

  setSelectedFile: (path: string | null) => set({ selectedFilePath: path }),

  openFile: (path: string) => set((state) => {
    const alreadyOpen = state.openFiles.includes(path)
    return {
      selectedFilePath: path,
      openFiles: alreadyOpen ? state.openFiles : [...state.openFiles, path],
      activeTab: path,
    }
  }),

  closeFile: (path: string) => set((state) => {
    const next = state.openFiles.filter((f) => f !== path)
    const wasActive = state.activeTab === path
    return {
      openFiles: next,
      activeTab: wasActive ? (next.length > 0 ? next[next.length - 1] : 'work') : state.activeTab,
      selectedFilePath: wasActive ? (next.length > 0 ? next[next.length - 1] : null) : state.selectedFilePath,
    }
  }),

  setActiveTab: (tab: 'work' | string) => set({ activeTab: tab }),

  setTree: (worktreeId: string, root: FileTreeNode) => {
    set((state) => ({
      treeByWorktree: { ...state.treeByWorktree, [worktreeId]: root }
    }))
  },

  toggleExpand: (worktreeId: string, path: string) => {
    set((state) => {
      const current = state.expandedPaths[worktreeId] ?? new Set<string>()
      const next = new Set(current)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return {
        expandedPaths: { ...state.expandedPaths, [worktreeId]: next }
      }
    })
  },

  isExpanded: (worktreeId: string, path: string) => {
    return get().expandedPaths[worktreeId]?.has(path) ?? false
  }
}))
