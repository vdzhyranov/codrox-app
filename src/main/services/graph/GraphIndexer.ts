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

  constructor(private store: GraphStore, workspaceRoot: string) {
    this.fileIndexer = new FileIndexer(workspaceRoot)
    this.gitIndexer = new GitIndexer(workspaceRoot)
    this.agentIndexer = new AgentIndexer(workspaceRoot)
    this.conceptIndexer = new ConceptIndexer(workspaceRoot)
  }

  /** Full reindex: files + symbols + git history + agent activity. */
  async reindexAll(): Promise<GraphStats> {
    for (const abs of this.fileIndexer.walk()) {
      this.indexFileAbs(abs)
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
    this.store.replaceOutgoing(result.fileNode.id, 'imports', result.importEdges)
    this.store.replaceOutgoing(result.fileNode.id, 'defines', result.defineEdges)
  }

  /** Remove a file's nodes/edges (used when a file is deleted). */
  removeFileAbs(absPath: string): void {
    // Caller passes absolute path; we need the relative form to compute the node ID.
    // Delegate via FileIndexer: it knows the workspace root.
    const fakeIndex = this.fileIndexer.idForAbs(absPath)
    if (!fakeIndex) return
    this.store.deleteNode(fakeIndex)
  }
}
