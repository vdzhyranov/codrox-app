import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useActiveWorkspaceId } from '@renderer/hooks/useActiveWorkspaceId'
import { useRef, useCallback } from 'react'
import { usePTY } from '@renderer/hooks/usePTY'
import { usePTYFileDrop } from '@renderer/hooks/usePTYFileDrop'
import type { TerminalTab as TerminalTabType } from '@shared/types'

export function TerminalTab({ tab }: { tab: TerminalTabType }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeWorktreePath = useActiveWorktreePath()
  const activeWorkspaceId = useActiveWorkspaceId()

  usePTY({
    ptyId: tab.ptyId,
    worktreeId: tab.worktreeId,
    workspaceId: activeWorkspaceId ?? undefined,
    cwd: activeWorktreePath || '/',
    type: 'terminal',
    containerRef
  })

  const formatPath = useCallback((p: string) => (p.includes(' ') ? `'${p}'` : p), [])
  const { isDragging } = usePTYFileDrop({ containerRef, ptyId: tab.ptyId, formatPath })

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full bg-zinc-900" />
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-900/70">
          <div className="rounded-lg border border-dashed border-blue-400 px-8 py-6 text-blue-300 text-sm">
            Drop files to insert path
          </div>
        </div>
      )}
    </div>
  )
}
