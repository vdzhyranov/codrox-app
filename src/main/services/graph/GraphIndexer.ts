import { statSync } from 'fs'
import { GraphStore } from './GraphStore'
import { FileIndexer } from './indexers/FileIndexer'
import { GitIndexer } from './indexers/GitIndexer'
import { AgentIndexer, toSessionNode } from './indexers/AgentIndexer'
import { ConceptIndexer } from './indexers/ConceptIndexer'
import type { SubAgentInfo } from '../SubAgentWatcher'
import type { GraphStats } from '@shared/types/graph'

/**
 * Coordinates indexers and writes results into the GraphStore.
 */
export class GraphIndexer {
  private fileIndexer: FileIndexer
  private gitIndexer: GitIndexer
  private agentIndexer: AgentIndexer
  private conceptIndexer: ConceptIndexer

  constructor(private store: GraphStore, private workspaceRoot: string) {
    this.fileIndexer = new FileIndexer(workspaceRoot)
    this.gitIndexer = new GitIndexer(workspaceRoot)
    this.agentIndexer = new AgentIndexer(workspaceRoot)
    this.conceptIndexer = new ConceptIndexer(workspaceRoot)
  }

  /**
   * Full reindex: files + symbols + git history + agent activity.
   *
   * scanPath overrides where files are walked (e.g. a git worktree path).
   * Git, agent, and concept indexers always use the workspace root so
   * commit history and agent sessions stay in the shared workspace graph.
   */
  async reindexAll(scanPath?: string): Promise<GraphStats> {
    // File scan: use worktree path when provided, otherwise workspace root.
    const scanner = scanPath && scanPath !== this.workspaceRoot
      ? new FileIndexer(scanPath)
      : this.fileIndexer

    let fileCount = 0
    for (const abs of scanner.walk()) {
      // Yield every 50 files so the main-process event loop stays responsive.
      if (++fileCount % 50 === 0) await new Promise<void>((r) => setImmediate(r))

      // Skip files whose mtime hasn't changed since the last index run.
      const nodeId = scanner.idForAbs(abs)
      if (nodeId) {
        const existing = this.store.getNode(nodeId)
        if (existing && typeof existing.meta.mtime === 'number') {
          let diskMtime: number | undefined
          try { diskMtime = statSync(abs).mtimeMs } catch { continue }
          if (diskMtime === existing.meta.mtime) continue
        }
      }

      const result = scanner.indexFile(abs)
      if (!result) continue
      this.store.upsertNode(result.fileNode)
      for (const n of result.importedFileNodes) this.store.upsertNode(n)
      for (const n of result.symbolNodes) this.store.upsertNode(n)
      this.store.replaceOutgoingFromSource(result.fileNode.id, 'imports', 'indexer', result.importEdges)
      this.store.replaceOutgoingFromSource(result.fileNode.id, 'defines', 'indexer', result.defineEdges)
    }

    const git = await this.gitIndexer.index()
    for (const n of git.commitNodes) this.store.upsertNode(n)
    for (const e of git.modifiedByEdges) this.store.upsertEdge(e)

    const agents = this.agentIndexer.index()
    for (const n of agents.sessionNodes) this.store.upsertNode(n)
    for (const n of agents.fileStubs) this.store.upsertNode(n)
    for (const e of agents.workedOnEdges) this.store.upsertEdge(e)

    const concepts = this.conceptIndexer.index()
    for (const n of concepts.conceptNodes) this.store.upsertNode(n)
    for (const e of concepts.relatedToEdges) this.store.upsertEdge(e)

    const ts = Date.now()
    this.store.setLastIndexedAt(ts)
    return { ...this.store.stats(), lastIndexedAt: ts }
  }

  /** Live update: record a single new agent session as it appears. */
  recordAgentSession(info: SubAgentInfo): void {
    this.store.upsertNode(toSessionNode(info))
  }

  /** Incremental: re-index a single file. */
  indexFileAbs(absPath: string): void {
    const result = this.fileIndexer.indexFile(absPath)
    if (!result) return
    this.store.upsertNode(result.fileNode)
    // Imported files may not exist as nodes yet; upsert stubs so edges have valid endpoints.
    for (const n of result.importedFileNodes) this.store.upsertNode(n)
    for (const n of result.symbolNodes) this.store.upsertNode(n)
    // 'indexer' scope: leaves any Claude-authored 'imports'/'defines' edges (rare, but possible) intact.
    this.store.replaceOutgoingFromSource(result.fileNode.id, 'imports', 'indexer', result.importEdges)
    this.store.replaceOutgoingFromSource(result.fileNode.id, 'defines', 'indexer', result.defineEdges)
  }

  /** Remove a file's nodes/edges (used when a file is deleted). */
  removeFileAbs(absPath: string): void {
    const nodeId = this.fileIndexer.idForAbs(absPath)
    if (!nodeId) return
    // Symbols defined by the file would otherwise outlive it: delete them first,
    // then drop the file node (cascade clears any remaining edges).
    this.store.deleteSymbolsForFile(nodeId)
    this.store.deleteNode(nodeId)
  }
}
