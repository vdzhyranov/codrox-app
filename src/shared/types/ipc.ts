import type { Workspace, Worktree, AppState } from './workspace'
import type { FileTreeNode, FileChangeEvent } from './filesystem'
import type { GitFileStatus } from './git'
import type { LinearUser, LinearTeam, LinearTask, LinearAuthState, CreateTaskInput, WorktreeLinearLink } from './linear'

// Request-response channel definitions
export interface IpcChannels {
  'workspace:open': {
    request: { path: string }
    response: Workspace
  }
  'workspace:add': {
    request: { path: string }
    response: Workspace
  }
  'workspace:remove': {
    request: { id: string }
    response: { success: boolean }
  }
  'workspace:list': {
    request: void
    response: Workspace[]
  }
  'workspace:getState': {
    request: void
    response: AppState
  }
  'workspace:getRecent': {
    request: void
    response: Workspace[]
  }
  'worktree:create': {
    request: { workspaceId: string; workspacePath: string; branch: string; name: string }
    response: Worktree
  }
  'worktree:list': {
    request: { workspaceId: string; workspacePath: string }
    response: Worktree[]
  }
  'worktree:remove': {
    request: { workspaceId: string; workspacePath: string; worktreePath: string }
    response: { success: boolean }
  }
  'git:renameBranch': {
    request: { worktreePath: string; oldName: string; newName: string }
    response: void
  }
  'dialog:openDirectory': {
    request: void
    response: string | null
  }
  'fs:readDir': {
    request: { path: string; depth?: number }
    response: FileTreeNode
  }
  'fs:search': {
    request: { rootPath: string; query: string; limit?: number }
    response: { name: string; path: string; relativePath: string }[]
  }
  'fs:readFile': {
    request: { path: string }
    response: { content: string }
  }
  'fs:writeFile': {
    request: { path: string; content: string }
    response: { success: boolean }
  }
  'fs:watch': {
    request: { worktreeId: string; path: string }
    response: void
  }
  'fs:unwatch': {
    request: { worktreeId: string }
    response: void
  }
  'git:status': {
    request: { worktreePath: string }
    response: GitFileStatus[]
  }
  'git:diff': {
    request: { worktreePath: string; filePath: string }
    response: { diff: string }
  }
  // Linear integration
  'linear:auth': {
    request: { apiKey: string }
    response: { success: boolean; user: LinearUser | null }
  }
  'linear:getApiKey': {
    request: void
    response: { apiKey: string }
  }
  'linear:logout': {
    request: void
    response: { success: boolean }
  }
  'linear:status': {
    request: void
    response: LinearAuthState
  }
  'linear:fetchTasks': {
    request: { teamId?: string } | void
    response: LinearTask[]
  }
  'linear:createTask': {
    request: CreateTaskInput
    response: LinearTask
  }
  'linear:getTeams': {
    request: void
    response: LinearTeam[]
  }
  'linear:getBranchName': {
    request: { taskId: string }
    response: { branchName: string }
  }
  'linear:linkWorktree': {
    request: { worktreePath: string; taskId: string; taskIdentifier: string }
    response: { success: boolean }
  }
  'linear:getLinkedTask': {
    request: { worktreePath: string }
    response: WorktreeLinearLink | null
  }
  'linear:unlinkWorktree': {
    request: { worktreePath: string }
    response: { success: boolean }
  }
  'pty:create': {
    request: {
      id: string
      worktreeId: string
      cwd: string
      shell?: string
      args?: string[]
      type: 'claude' | 'terminal'
    }
    response: void
  }
  'pty:write': {
    request: { id: string; data: string }
    response: void
  }
  'pty:resize': {
    request: { id: string; cols: number; rows: number }
    response: void
  }
  'pty:destroy': {
    request: { id: string }
    response: void
  }
}

// Streaming event channel payload types
export interface IpcEventChannels {
  'pty:output': { id: string; data: string }
  'pty:exit': { id: string; exitCode: number }
  'fs:changed': { worktreeId: string; events: FileChangeEvent[] }
}

// Helper types for type-safe invoke/listen
export type IpcChannel = keyof IpcChannels
export type IpcEventChannel = keyof IpcEventChannels

export type IpcRequest<C extends IpcChannel> = IpcChannels[C]['request']
export type IpcResponse<C extends IpcChannel> = IpcChannels[C]['response']
export type IpcEventPayload<C extends IpcEventChannel> = IpcEventChannels[C]
