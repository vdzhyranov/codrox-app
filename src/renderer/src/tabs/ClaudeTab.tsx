import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useRef } from 'react'
import { usePTY } from '@renderer/hooks/usePTY'
import type { ClaudeTab as ClaudeTabType } from '@shared/types'

export function ClaudeTab({ tab }: { tab: ClaudeTabType }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeWorktreePath = useActiveWorktreePath()

  usePTY({
    ptyId: tab.ptyId,
    worktreeId: tab.worktreeId,
    cwd: activeWorktreePath || '/',
    type: 'claude',
    containerRef
  })

  return <div ref={containerRef} className="h-full w-full bg-zinc-900" />
}
