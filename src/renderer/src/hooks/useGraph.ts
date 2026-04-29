import { useCallback, useEffect, useRef, useState } from 'react'
import { ipc } from '@renderer/lib/ipc'
import type { GraphNodeType, GraphStats, GraphSubgraph } from '@shared/types/graph'

export interface UseGraph {
  stats: GraphStats | null
  results: GraphSubgraph
  query: string
  setQuery: (q: string) => void
  nodeTypes: GraphNodeType[]
  setNodeTypes: (types: GraphNodeType[]) => void
  reindex: () => Promise<void>
  loadNeighbors: (nodeId: string) => Promise<void>
  isIndexing: boolean
  isSearching: boolean
}

/**
 * workspacePath  — the main workspace root, used as the DB key (shared across all worktrees).
 * worktreePath   — the active worktree to scan when reindexing; defaults to workspacePath.
 *                  Changing this triggers an automatic reindex so the graph stays in sync
 *                  with the currently-checked-out branch.
 */
export function useGraph(workspacePath: string | null, worktreePath?: string | null): UseGraph {
  const [stats, setStats] = useState<GraphStats | null>(null)
  const [results, setResults] = useState<GraphSubgraph>({ nodes: [], edges: [] })
  const [query, setQuery] = useState('')
  const [nodeTypes, setNodeTypes] = useState<GraphNodeType[]>([])
  const [isIndexing, setIsIndexing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const reqToken = useRef(0)
  // Track the last worktree we indexed so we only reindex on actual worktree changes.
  const lastIndexedKey = useRef<string | null>(null)

  // Load stats whenever the workspace changes.
  useEffect(() => {
    if (!workspacePath) {
      setStats(null)
      setResults({ nodes: [], edges: [] })
      return
    }
    let cancelled = false
    ipc
      .invoke('graph:stats', { workspacePath })
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .catch((err) => {
        if (!cancelled) console.error('graph:stats failed', err)
      })
    return () => {
      cancelled = true
    }
  }, [workspacePath])

  // Auto-reindex when the active worktree changes (different branch = different files).
  useEffect(() => {
    if (!workspacePath) return
    const scanPath = worktreePath ?? workspacePath
    const key = `${workspacePath}::${scanPath}`
    if (key === lastIndexedKey.current) return
    lastIndexedKey.current = key

    let cancelled = false
    setIsIndexing(true)
    ipc
      .invoke('graph:reindex', { workspacePath, scanPath })
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .catch((err) => {
        if (!cancelled) console.error('graph:reindex failed', err)
      })
      .finally(() => {
        if (!cancelled) setIsIndexing(false)
      })
    return () => {
      cancelled = true
    }
  }, [workspacePath, worktreePath])

  // Debounced search.
  useEffect(() => {
    if (!workspacePath) return
    if (!query.trim()) {
      setResults({ nodes: [], edges: [] })
      return
    }
    const handle = setTimeout(async () => {
      const myToken = ++reqToken.current
      setIsSearching(true)
      try {
        const r = await ipc.invoke('graph:search', {
          workspacePath,
          q: query,
          limit: 50,
          nodeTypes: nodeTypes.length > 0 ? nodeTypes : undefined
        })
        if (myToken === reqToken.current) setResults(r)
      } catch (err) {
        console.error('graph:search failed', err)
      } finally {
        if (myToken === reqToken.current) setIsSearching(false)
      }
    }, 150)
    return () => clearTimeout(handle)
  }, [workspacePath, query, nodeTypes])

  const reindex = useCallback(async () => {
    if (!workspacePath) return
    const scanPath = worktreePath ?? workspacePath
    setIsIndexing(true)
    try {
      const s = await ipc.invoke('graph:reindex', { workspacePath, scanPath })
      setStats(s)
      // Reset so the auto-effect re-arms for the current key after a manual reindex.
      lastIndexedKey.current = `${workspacePath}::${scanPath}`
    } catch (err) {
      console.error('graph:reindex failed', err)
    } finally {
      setIsIndexing(false)
    }
  }, [workspacePath, worktreePath])

  const loadNeighbors = useCallback(
    async (nodeId: string) => {
      if (!workspacePath) return
      const myToken = ++reqToken.current
      try {
        const r = await ipc.invoke('graph:neighbors', { workspacePath, nodeId })
        if (myToken === reqToken.current) setResults(r)
      } catch (err) {
        console.error('graph:neighbors failed', err)
      }
    },
    [workspacePath]
  )

  return { stats, results, query, setQuery, nodeTypes, setNodeTypes, reindex, loadNeighbors, isIndexing, isSearching }
}
