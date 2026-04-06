export type TabType = 'claude' | 'terminal' | 'editor'

export interface TabBase {
  id: string
  type: TabType
  title: string
  worktreeId: string
}

export interface EditorTab extends TabBase {
  type: 'editor'
  filePath: string
  isDirty: boolean
}

export interface TerminalTab extends TabBase {
  type: 'terminal'
  ptyId: string
}

export interface ClaudeTab extends TabBase {
  type: 'claude'
  ptyId: string
}

export type Tab = EditorTab | TerminalTab | ClaudeTab

// ── Pane tree types ──────────────────────────────────────────────────────────

export interface PaneLeaf {
  type: 'leaf'
  id: string
  tabId: string | null
}

export interface PaneSplit {
  type: 'split'
  id: string
  direction: 'horizontal' | 'vertical'
  ratio: number
  first: PaneNode
  second: PaneNode
}

export type PaneNode = PaneLeaf | PaneSplit
