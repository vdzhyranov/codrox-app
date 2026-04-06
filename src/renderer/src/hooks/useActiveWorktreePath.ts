import { useWorkspaceStore } from '@renderer/store/workspaceStore'

export function useActiveWorktreePath(): string | null {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const activeWorktreeId = useWorkspaceStore((s) => s.activeWorktreeId)
  const worktreesByWorkspace = useWorkspaceStore((s) => s.worktreesByWorkspace)

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId)
  if (!workspace) return null

  if (!activeWorktreeId) return workspace.path

  const worktrees = worktreesByWorkspace[workspace.id] ?? []
  const wt = worktrees.find((w) => w.id === activeWorktreeId)
  return wt ? wt.path : workspace.path
}
