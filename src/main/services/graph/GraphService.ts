import { GraphStore } from './GraphStore'
import { GraphIndexer } from './GraphIndexer'
import type { SubAgentInfo } from '../SubAgentWatcher'
import type { FileChangeEvent } from '@shared/types/filesystem'
import type { GraphRelation, GraphStats, GraphSubgraph } from '@shared/types/graph'

/**
 * Owns one GraphStore + GraphIndexer per open workspace, keyed by workspace path.
 * Lazy-opens on first query; caller is responsible for triggering reindex.
 */
class GraphService {
  private byWorkspace = new Map<string, { store: GraphStore; indexer: GraphIndexer }>()

  private open(workspacePath: string): { store: GraphStore; indexer: GraphIndexer } {
    let entry = this.byWorkspace.get(workspacePath)
    if (!entry) {
      const store = new GraphStore(workspacePath)
      const indexer = new GraphIndexer(store, workspacePath)
      entry = { store, indexer }
      this.byWorkspace.set(workspacePath, entry)
    }
    return entry
  }

  async reindex(workspacePath: string): Promise<GraphStats> {
    return this.open(workspacePath).indexer.reindexAll()
  }

  /** Record a freshly-spawned agent session in any open workspace's graph. */
  recordAgentSession(workspacePath: string, info: SubAgentInfo): void {
    const entry = this.byWorkspace.get(workspacePath)
    if (!entry) return
    entry.indexer.recordAgentSession(info)
  }

  search(workspacePath: string, query: string, limit = 30): GraphSubgraph {
    const nodes = this.open(workspacePath).store.searchNodes(query, limit)
    return { nodes, edges: [] }
  }

  neighbors(
    workspacePath: string,
    nodeId: string,
    relation?: GraphRelation,
    direction: 'out' | 'in' | 'both' = 'both'
  ): GraphSubgraph {
    const { store } = this.open(workspacePath)
    const center = store.getNode(nodeId)
    const result = store.neighbors(nodeId, { relation, direction })
    const nodes = center
      ? [center, ...result.nodes.filter((n) => n.id !== center.id)]
      : result.nodes
    return { nodes, edges: result.edges }
  }

  stats(workspacePath: string): GraphStats {
    return this.open(workspacePath).store.stats()
  }

  /**
   * Route filesystem change events to whichever already-open workspace contains them.
   * We deliberately do NOT lazy-open new workspaces here — that would create graph DBs
   * for every watched directory regardless of user intent.
   */
  handleFileEvents(events: FileChangeEvent[]): void {
    if (this.byWorkspace.size === 0) return
    const buckets = new Map<string, FileChangeEvent[]>()
    for (const ev of events) {
      const ws = this.findOwningWorkspace(ev.path)
      if (!ws) continue
      const list = buckets.get(ws) ?? []
      list.push(ev)
      buckets.set(ws, list)
    }
    for (const [ws, list] of buckets) {
      const entry = this.byWorkspace.get(ws)
      if (!entry) continue
      for (const ev of list) {
        if (ev.type === 'delete') {
          entry.indexer.removeFileAbs(ev.path)
        } else {
          entry.indexer.indexFileAbs(ev.path)
        }
      }
    }
  }

  private findOwningWorkspace(absPath: string): string | null {
    let best: string | null = null
    for (const ws of this.byWorkspace.keys()) {
      if (absPath.startsWith(ws + '/') && (!best || ws.length > best.length)) {
        best = ws
      }
    }
    return best
  }

  closeAll(): void {
    for (const { store } of this.byWorkspace.values()) store.close()
    this.byWorkspace.clear()
  }
}

export const graphService = new GraphService()
