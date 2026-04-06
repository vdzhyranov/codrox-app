import { useEffect, useRef } from 'react'
import { useTabStore } from '@renderer/store/tabStore'

export function useSubAgentWatcher(worktreePath: string | null, enabled: boolean): void {
  const openTab = useTabStore((s) => s.openTab)
  const splitPane = useTabStore((s) => s.splitPane)
  const focusedPaneByWorktree = useTabStore((s) => s.focusedPaneByWorktree)
  const panesByWorktree = useTabStore((s) => s.panesByWorktree)

  // Keep a ref to the latest store values so the event listener always has fresh data
  const storeRef = useRef({ openTab, splitPane, focusedPaneByWorktree, panesByWorktree })
  useEffect(() => {
    storeRef.current = { openTab, splitPane, focusedPaneByWorktree, panesByWorktree }
  })

  const worktreePathRef = useRef(worktreePath)
  useEffect(() => {
    worktreePathRef.current = worktreePath
  }, [worktreePath])

  useEffect(() => {
    if (!enabled || !worktreePath) return

    // Delay start to avoid race with workspace initialization
    const timer = setTimeout(() => {
      window.api.invoke('subagents:watch', { workspacePath: worktreePath }).catch(() => {})
    }, 3000)

    const unsub = window.api.on('subagents:new', (payload: unknown) => {
      const { agentId, task } = payload as { agentId: string; task: string }
      const path = worktreePathRef.current
      if (!path) return

      const { openTab: addTab, splitPane: split, focusedPaneByWorktree: focused, panesByWorktree: panes } =
        storeRef.current

      const tabId = `subagent-${agentId}-${Date.now()}`
      const truncatedTask = task.length > 40 ? `${task.slice(0, 40)}…` : task
      const title = `Agent: ${truncatedTask}`

      // Add the tab to the worktree tab list
      addTab(path, {
        id: tabId,
        type: 'terminal',
        title,
        worktreeId: path,
        ptyId: tabId,
      })

      // Find the focused pane leaf and split it to show the new agent tab
      const focusedPaneId = focused[path] ?? null
      const root = panes[path]
      if (focusedPaneId && root) {
        split(path, focusedPaneId, 'horizontal')
      }
    })

    return () => {
      clearTimeout(timer)
      unsub()
      window.api.invoke('subagents:unwatch', {}).catch(() => {})
    }
  }, [enabled, worktreePath])
}
