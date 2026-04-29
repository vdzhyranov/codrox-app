import { useWorkspaceStore } from '@renderer/store/workspaceStore'

export function useActiveWorkspaceId(): string | null {
  return useWorkspaceStore((s) => s.activeWorkspaceId)
}
