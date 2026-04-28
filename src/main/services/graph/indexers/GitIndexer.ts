import simpleGit from 'simple-git'
import type { GraphEdge, GraphNode } from '@shared/types/graph'

const COMMIT_LIMIT = 200

export interface IndexedGit {
  commitNodes: GraphNode[]
  modifiedByEdges: GraphEdge[]
}

/**
 * Walk recent git history and emit `commit` nodes + `modifiedBy` edges (file → commit).
 * Files that appear here may not be present in the file walk (deleted/renamed) — that's
 * fine; we still create stub file nodes so edges resolve in queries.
 */
export class GitIndexer {
  constructor(private workspaceRoot: string) {}

  async index(): Promise<IndexedGit> {
    const commitNodes: GraphNode[] = []
    const modifiedByEdges: GraphEdge[] = []
    const fileStubs = new Map<string, GraphNode>()
    const now = Date.now()

    const git = simpleGit(this.workspaceRoot)
    let isRepo = false
    try {
      isRepo = await git.checkIsRepo()
    } catch {
      isRepo = false
    }
    if (!isRepo) return { commitNodes, modifiedByEdges }

    let raw: string
    try {
      raw = await git.raw([
        'log',
        `--max-count=${COMMIT_LIMIT}`,
        '--pretty=format:__C__%H|%aI|%s',
        '--name-only'
      ])
    } catch {
      return { commitNodes, modifiedByEdges }
    }

    // Parse: each commit starts with __C__<hash>|<iso-date>|<subject>, followed by file paths.
    const blocks = raw.split('__C__').filter(Boolean)
    for (const block of blocks) {
      const lines = block.split('\n')
      const header = lines[0]
      const [hash, isoDate, ...rest] = header.split('|')
      if (!hash) continue
      const subject = rest.join('|')
      const ts = Date.parse(isoDate || '') || now
      const commitId = `commit:${hash.slice(0, 12)}`
      commitNodes.push({
        id: commitId,
        type: 'commit',
        label: subject.slice(0, 80) || hash.slice(0, 12),
        meta: { hash, fullSubject: subject, date: isoDate },
        updatedAt: ts
      })
      for (const line of lines.slice(1)) {
        const path = line.trim()
        if (!path) continue
        const fileNodeId = `file:${path}`
        if (!fileStubs.has(fileNodeId)) {
          fileStubs.set(fileNodeId, {
            id: fileNodeId,
            type: 'file',
            label: path.split('/').pop() ?? path,
            meta: { path },
            updatedAt: now
          })
        }
        modifiedByEdges.push({
          id: `edge:${fileNodeId}->${commitId}:modifiedBy`,
          fromId: fileNodeId,
          toId: commitId,
          relation: 'modifiedBy',
          weight: 1
        })
      }
    }

    // Append stubs at the end so callers can upsert them without overwriting richer file nodes.
    return {
      commitNodes: [...commitNodes, ...fileStubs.values()],
      modifiedByEdges
    }
  }
}
