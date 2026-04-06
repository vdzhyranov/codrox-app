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

export type LifecyclePhase = 'propose' | 'grill' | 'research' | 'plan' | 'implement' | 'verify'

export type WorktreeMode = 'terminal' | 'claude' | 'lifecycle' | null

export interface SessionData {
  activeWorkspaceId: string | null
  activeWorktreeId: string | null
  modeByWorktree: Record<string, string>
}

export interface LifecycleState {
  phase: LifecyclePhase | null
  propose?: {
    name: string
    problem: string
    solution: string
    criteria: string
    questions?: string
  }
  grillSummary?: string
  researchSummary?: string
  plan?: {
    tasks: Array<{ id: string; title: string; done: boolean; effort?: string }>
  }
  implementNotes?: string
  verify?: {
    items: Array<{ id: string; label: string; passed: boolean | null }>
  }
}
