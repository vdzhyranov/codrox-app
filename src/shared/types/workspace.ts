import type { Tab } from './tabs'

export interface Workspace {
  id: string
  path: string
  name: string
  lastOpened: number
}

export interface Worktree {
  id: string
  workspaceId: string
  path: string
  branch: string
  name: string
  isMain: boolean
  /** True if this worktree was created outside of Codrox (e.g. Claude Desktop, CLI). */
  isExternal?: boolean
  /** True if a Claude session is actively writing to this worktree's tmp transcript dir. */
  hasActiveSession?: boolean
}

export interface WorktreeState {
  worktreeId: string
  path: string
  branch: string
  openTabs: Tab[]
  activeTabId: string | null
}

export interface AppState {
  activeWorktreePath: string | null
  recentWorkspaces: Workspace[]
}

export type WorktreeMode = 'terminal' | 'claude' | null

export interface SessionData {
  activeWorkspaceId: string | null
  activeWorktreeId: string | null
  modeByWorktree: Record<string, string>
}
