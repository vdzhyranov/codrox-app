import { useEffect } from 'react'
import { useActiveWorktreePath } from './useActiveWorktreePath'
import { useActiveWorkspaceId } from './useActiveWorkspaceId'

/**
 * Fires pty:create for the default claude panel as soon as the active worktree
 * path is known — before WorkspaceView mounts. By the time the pane renders,
 * the shell is already up and claude is already starting.
 */
export function usePTYPrewarm(): void {
  const worktreePath = useActiveWorktreePath()
  const workspaceId = useActiveWorkspaceId()

  useEffect(() => {
    if (!worktreePath || !workspaceId) return

    const worktreeBase = (worktreePath.split('/').pop() ?? 'workspace').replace(/[^a-zA-Z0-9-]/g, '-')
    const sessionName = `codrox-${worktreeBase}-claude-main`

    ;(window.api.invoke('pty:create', {
      id: sessionName,
      worktreeId: sessionName,
      workspaceId,
      cwd: worktreePath,
      type: 'claude',
    }) as Promise<void>).catch(() => {})
  }, [worktreePath, workspaceId])
}
