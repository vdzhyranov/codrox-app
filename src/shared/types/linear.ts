export interface LinearUser {
  id: string
  name: string
  email: string
  displayName: string
}

export interface LinearTeam {
  id: string
  name: string
  key: string
}

export interface LinearTaskState {
  name: string
  color: string
  type: string
}

export interface LinearLabel {
  name: string
  color: string
}

export interface LinearTask {
  id: string
  identifier: string
  title: string
  description: string | null
  state: LinearTaskState
  priority: number
  branchName: string
  url: string
  teamId: string
  createdAt: string
  updatedAt: string
  labels: LinearLabel[]
}

export interface LinearAuthState {
  isAuthenticated: boolean
  user: LinearUser | null
}

export interface CreateTaskInput {
  title: string
  description?: string
  teamId: string
  priority?: number
}

export interface WorktreeLinearLink {
  worktreePath: string
  taskId: string
  taskIdentifier: string
}
