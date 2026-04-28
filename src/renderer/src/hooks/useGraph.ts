import { useCallback, useEffect, useState } from 'react'
import { ipc } from '@renderer/lib/ipc'
import type { GraphStats, GraphSubgraph } from '@shared/types/graph'

export interface UseGraph {
  stats: GraphStats | null
  results: GraphSubgraph
  query: string
  setQuery: (q: string) => void
  reindex: () => Promise<void>
  loadNeighbors: (nodeId: string) => Promise<void>
  isIndexing: boolean
  isSearching: boolean
}

export function useGraph(workspacePath: string | null): UseGraph {
  const [stats, setStats] = useState<GraphStats | null>(null)
  const [results, setResults] = useState<GraphSubgraph>({ nodes: [], edges: [] })
  const [query, setQuery] = useState('')
  const [isIndexing, setIsIndexing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  // Load stats whenever the workspace changes.
  useEffect(() => {
    if (!workspacePath) {
      setStats(null)
      setResults({ nodes: [], edges: [] })
      return
    }
    let cancelled = false
    ipc.invoke('graph:stats', { workspacePath }).then((s) => {
      if (!cancelled) setStats(s)
    })
    return () => {
      cancelled = true
    }
  }, [workspacePath])

  // Debounced search.
  useEffect(() => {
    if (!workspacePath) return
    if (!query.trim()) {
      setResults({ nodes: [], edges: [] })
      return
    }
    const handle = setTimeout(async () => {
      setIsSearching(true)
      try {
        const r = await ipc.invoke('graph:search', { workspacePath, q: query, limit: 50 })
        setResults(r)
      } finally {
        setIsSearching(false)
      }
    }, 150)
    return () => clearTimeout(handle)
  }, [workspacePath, query])

  const reindex = useCallback(async () => {
    if (!workspacePath) return
    setIsIndexing(true)
    try {
      const s = await ipc.invoke('graph:reindex', { workspacePath })
      setStats(s)
    } finally {
      setIsIndexing(false)
    }
  }, [workspacePath])

  const loadNeighbors = useCallback(
    async (nodeId: string) => {
      if (!workspacePath) return
      const r = await ipc.invoke('graph:neighbors', { workspacePath, nodeId })
      setResults(r)
    },
    [workspacePath]
  )

  return { stats, results, query, setQuery, reindex, loadNeighbors, isIndexing, isSearching }
}
