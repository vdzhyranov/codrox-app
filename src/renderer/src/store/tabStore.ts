import { create } from 'zustand'
import type { Tab, PaneNode, PaneLeaf, PaneSplit } from '@shared/types'

// ── Pane tree helpers ────────────────────────────────────────────────────────

function makeId(): string {
  return Math.random().toString(36).slice(2, 9)
}

function makeLeaf(tabId: string | null = null): PaneLeaf {
  return { type: 'leaf', id: makeId(), tabId }
}

function findNode(root: PaneNode, id: string): PaneNode | null {
  if (root.id === id) return root
  if (root.type === 'split') {
    return findNode(root.first, id) ?? findNode(root.second, id)
  }
  return null
}

/** Replace a node in the tree, returning a new root. Returns null if id not found. */
function replaceNode(root: PaneNode, id: string, replacement: PaneNode): PaneNode | null {
  if (root.id === id) return replacement
  if (root.type === 'split') {
    const first = replaceNode(root.first, id, replacement)
    if (first !== null) return { ...root, first }
    const second = replaceNode(root.second, id, replacement)
    if (second !== null) return { ...root, second }
  }
  return null
}

/**
 * Remove a pane leaf by id, promoting its sibling to replace the parent split.
 * Returns new root or null if pane not found / it is the root.
 */
function removePane(root: PaneNode, id: string): PaneNode | null {
  if (root.id === id) return null // caller handles root case
  if (root.type !== 'split') return null
  if (root.first.id === id) return root.second
  if (root.second.id === id) return root.first
  const first = removePane(root.first, id)
  if (first !== null) return { ...root, first }
  const second = removePane(root.second, id)
  if (second !== null) return { ...root, second }
  return null
}

/** Collect all leaf ids in the tree */
function collectLeafIds(root: PaneNode): string[] {
  if (root.type === 'leaf') return [root.id]
  return [...collectLeafIds(root.first), ...collectLeafIds(root.second)]
}

// ── Store types ──────────────────────────────────────────────────────────────

interface TabState {
  tabsByWorktree: Record<string, Tab[]>
  activeTabByWorktree: Record<string, string | null>
  panesByWorktree: Record<string, PaneNode>
  focusedPaneByWorktree: Record<string, string>
}

interface TabActions {
  openTab: (worktreeId: string, tab: Tab) => void
  closeTab: (worktreeId: string, tabId: string) => void
  setActiveTab: (worktreeId: string, tabId: string) => void
  getTabs: (worktreeId: string) => Tab[]
  getActiveTab: (worktreeId: string) => Tab | null
  reorderTab: (worktreeId: string, tabId: string, newIndex: number) => void
  // Pane actions
  splitPane: (worktreeId: string, paneId: string, direction: 'horizontal' | 'vertical') => void
  closePane: (worktreeId: string, paneId: string) => void
  setPaneTab: (worktreeId: string, paneId: string, tabId: string) => void
  setPaneRatio: (worktreeId: string, splitId: string, ratio: number) => void
  getFocusedPaneId: (worktreeId: string) => string | null
  setFocusedPane: (worktreeId: string, paneId: string) => void
  getOrCreatePane: (worktreeId: string) => PaneNode
}

type TabStore = TabState & TabActions

export const useTabStore = create<TabStore>((set, get) => ({
  tabsByWorktree: {},
  activeTabByWorktree: {},
  panesByWorktree: {},
  focusedPaneByWorktree: {},

  openTab: (worktreeId: string, tab: Tab) => {
    set((state) => {
      const existing = state.tabsByWorktree[worktreeId] ?? []
      const alreadyOpen = existing.some((t) => t.id === tab.id)
      const tabs = alreadyOpen ? existing : [...existing, tab]

      // Assign the new tab to the focused pane (or root leaf if no pane yet)
      let panes = state.panesByWorktree
      let focused = state.focusedPaneByWorktree
      const root = state.panesByWorktree[worktreeId]
      if (!root) {
        const leaf = makeLeaf(tab.id)
        panes = { ...panes, [worktreeId]: leaf }
        focused = { ...focused, [worktreeId]: leaf.id }
      } else {
        const focusedId = state.focusedPaneByWorktree[worktreeId]
        if (focusedId) {
          const node = findNode(root, focusedId)
          if (node?.type === 'leaf') {
            const updated = replaceNode(root, focusedId, { ...node, tabId: tab.id })
            if (updated) panes = { ...panes, [worktreeId]: updated }
          }
        }
      }

      return {
        tabsByWorktree: { ...state.tabsByWorktree, [worktreeId]: tabs },
        activeTabByWorktree: { ...state.activeTabByWorktree, [worktreeId]: tab.id },
        panesByWorktree: panes,
        focusedPaneByWorktree: focused,
      }
    })
  },

  closeTab: (worktreeId: string, tabId: string) => {
    set((state) => {
      const existing = state.tabsByWorktree[worktreeId] ?? []
      const tabs = existing.filter((t) => t.id !== tabId)
      const currentActive = state.activeTabByWorktree[worktreeId]
      let nextActive: string | null = currentActive ?? null
      if (currentActive === tabId) {
        const closedIndex = existing.findIndex((t) => t.id === tabId)
        const next = tabs[closedIndex] ?? tabs[closedIndex - 1] ?? null
        nextActive = next?.id ?? null
      }
      // Null out tab references in pane tree
      const root = state.panesByWorktree[worktreeId]
      let updatedRoot = root
      if (root) {
        const nullifyTab = (node: PaneNode): PaneNode => {
          if (node.type === 'leaf') return node.tabId === tabId ? { ...node, tabId: null } : node
          return { ...node, first: nullifyTab(node.first), second: nullifyTab(node.second) }
        }
        updatedRoot = nullifyTab(root)
      }
      return {
        tabsByWorktree: { ...state.tabsByWorktree, [worktreeId]: tabs },
        activeTabByWorktree: { ...state.activeTabByWorktree, [worktreeId]: nextActive },
        panesByWorktree: { ...state.panesByWorktree, [worktreeId]: updatedRoot },
      }
    })
  },

  setActiveTab: (worktreeId: string, tabId: string) => {
    set((state) => ({
      activeTabByWorktree: { ...state.activeTabByWorktree, [worktreeId]: tabId }
    }))
  },

  getTabs: (worktreeId: string) => {
    return get().tabsByWorktree[worktreeId] ?? []
  },

  getActiveTab: (worktreeId: string) => {
    const state = get()
    const tabs = state.tabsByWorktree[worktreeId] ?? []
    const activeId = state.activeTabByWorktree[worktreeId]
    if (!activeId) return null
    return tabs.find((t) => t.id === activeId) ?? null
  },

  reorderTab: (worktreeId: string, tabId: string, newIndex: number) => {
    set((state) => {
      const existing = state.tabsByWorktree[worktreeId] ?? []
      const oldIndex = existing.findIndex((t) => t.id === tabId)
      if (oldIndex === -1 || oldIndex === newIndex) return state
      const tabs = [...existing]
      const [moved] = tabs.splice(oldIndex, 1)
      tabs.splice(newIndex, 0, moved)
      return {
        tabsByWorktree: { ...state.tabsByWorktree, [worktreeId]: tabs }
      }
    })
  },

  // ── Pane actions ───────────────────────────────────────────────────────────

  getOrCreatePane: (worktreeId: string) => {
    const state = get()
    const root = state.panesByWorktree[worktreeId]
    if (root) return root
    const leaf = makeLeaf(state.activeTabByWorktree[worktreeId] ?? null)
    set((s) => ({
      panesByWorktree: { ...s.panesByWorktree, [worktreeId]: leaf },
      focusedPaneByWorktree: { ...s.focusedPaneByWorktree, [worktreeId]: leaf.id },
    }))
    return leaf
  },

  splitPane: (worktreeId: string, paneId: string, direction: 'horizontal' | 'vertical') => {
    set((state) => {
      const root = state.panesByWorktree[worktreeId]
      if (!root) return state
      const node = findNode(root, paneId)
      if (!node || node.type !== 'leaf') return state

      const tabs = state.tabsByWorktree[worktreeId] ?? []
      // Pick a different tab for the new pane if possible
      const currentTabId = node.tabId
      const otherTab = tabs.find((t) => t.id !== currentTabId) ?? tabs[0] ?? null

      const newLeaf = makeLeaf(otherTab?.id ?? null)
      const split: PaneSplit = {
        type: 'split',
        id: makeId(),
        direction,
        ratio: 0.5,
        first: node,
        second: newLeaf,
      }
      const newRoot = replaceNode(root, paneId, split)
      if (!newRoot) return state
      return {
        panesByWorktree: { ...state.panesByWorktree, [worktreeId]: newRoot },
        focusedPaneByWorktree: { ...state.focusedPaneByWorktree, [worktreeId]: newLeaf.id },
      }
    })
  },

  closePane: (worktreeId: string, paneId: string) => {
    set((state) => {
      const root = state.panesByWorktree[worktreeId]
      if (!root) return state
      // If root is the only pane, do nothing
      if (root.id === paneId) return state
      const newRoot = removePane(root, paneId)
      if (!newRoot) return state
      // If focused pane was closed, focus the first leaf of the new tree
      const focusedId = state.focusedPaneByWorktree[worktreeId]
      const newFocusedId = focusedId === paneId
        ? (collectLeafIds(newRoot)[0] ?? '')
        : focusedId
      return {
        panesByWorktree: { ...state.panesByWorktree, [worktreeId]: newRoot },
        focusedPaneByWorktree: { ...state.focusedPaneByWorktree, [worktreeId]: newFocusedId },
      }
    })
  },

  setPaneTab: (worktreeId: string, paneId: string, tabId: string) => {
    set((state) => {
      const root = state.panesByWorktree[worktreeId]
      if (!root) return state
      const node = findNode(root, paneId)
      if (!node || node.type !== 'leaf') return state
      const newRoot = replaceNode(root, paneId, { ...node, tabId })
      if (!newRoot) return state
      return {
        panesByWorktree: { ...state.panesByWorktree, [worktreeId]: newRoot },
      }
    })
  },

  setPaneRatio: (worktreeId: string, splitId: string, ratio: number) => {
    set((state) => {
      const root = state.panesByWorktree[worktreeId]
      if (!root) return state
      const node = findNode(root, splitId)
      if (!node || node.type !== 'split') return state
      const newRoot = replaceNode(root, splitId, { ...node, ratio })
      if (!newRoot) return state
      return {
        panesByWorktree: { ...state.panesByWorktree, [worktreeId]: newRoot },
      }
    })
  },

  getFocusedPaneId: (worktreeId: string) => {
    return get().focusedPaneByWorktree[worktreeId] ?? null
  },

  setFocusedPane: (worktreeId: string, paneId: string) => {
    set((state) => ({
      focusedPaneByWorktree: { ...state.focusedPaneByWorktree, [worktreeId]: paneId },
    }))
  },
}))
