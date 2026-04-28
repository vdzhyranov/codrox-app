import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { GraphEdge, GraphNode, GraphRelation, GraphStats } from '@shared/types/graph'

/**
 * One SQLite database per workspace, stored at `<workspacePath>/.codrox/knowledge.db`.
 * The graph travels with the repo, so users can gitignore or commit it as they prefer.
 */
export class GraphStore {
  private db: Database.Database

  constructor(workspacePath: string) {
    const codroxDir = join(workspacePath, '.codrox')
    if (!existsSync(codroxDir)) mkdirSync(codroxDir, { recursive: true })
    this.db = new Database(join(codroxDir, 'knowledge.db'))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.initSchema()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL,
        label       TEXT NOT NULL,
        meta        TEXT,
        updated_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);

      CREATE TABLE IF NOT EXISTS edges (
        id        TEXT PRIMARY KEY,
        from_id   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        to_id     TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        relation  TEXT NOT NULL,
        weight    REAL NOT NULL DEFAULT 1.0
      );
      CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);
      CREATE INDEX IF NOT EXISTS idx_edges_to   ON edges(to_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_triple
        ON edges(from_id, to_id, relation);

      CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
        label, meta,
        content=nodes,
        content_rowid=rowid
      );

      CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes BEGIN
        INSERT INTO nodes_fts(rowid, label, meta)
        VALUES (new.rowid, new.label, COALESCE(new.meta, ''));
      END;
      CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, label, meta)
        VALUES ('delete', old.rowid, old.label, COALESCE(old.meta, ''));
      END;
      CREATE TRIGGER IF NOT EXISTS nodes_au AFTER UPDATE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, label, meta)
        VALUES ('delete', old.rowid, old.label, COALESCE(old.meta, ''));
        INSERT INTO nodes_fts(rowid, label, meta)
        VALUES (new.rowid, new.label, COALESCE(new.meta, ''));
      END;

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
  }

  upsertNode(node: GraphNode): void {
    this.db
      .prepare(
        `INSERT INTO nodes (id, type, label, meta, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           type = excluded.type,
           label = excluded.label,
           meta = excluded.meta,
           updated_at = excluded.updated_at`
      )
      .run(node.id, node.type, node.label, JSON.stringify(node.meta), node.updatedAt)
  }

  upsertEdge(edge: GraphEdge): void {
    this.db
      .prepare(
        `INSERT INTO edges (id, from_id, to_id, relation, weight)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(from_id, to_id, relation) DO UPDATE SET
           weight = excluded.weight`
      )
      .run(edge.id, edge.fromId, edge.toId, edge.relation, edge.weight)
  }

  /** Replace all outgoing edges of a given relation for a node. Used during reindex. */
  replaceOutgoing(fromId: string, relation: GraphRelation, edges: GraphEdge[]): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM edges WHERE from_id = ? AND relation = ?').run(fromId, relation)
      for (const e of edges) this.upsertEdge(e)
    })
    tx()
  }

  deleteNode(id: string): void {
    this.db.prepare('DELETE FROM nodes WHERE id = ?').run(id)
  }

  /** Delete all symbol nodes that the given file defines. Run before deleting the file. */
  deleteSymbolsForFile(fileNodeId: string): void {
    this.db
      .prepare(
        `DELETE FROM nodes WHERE id IN (
           SELECT to_id FROM edges WHERE from_id = ? AND relation = 'defines'
         )`
      )
      .run(fileNodeId)
  }

  getNode(id: string): GraphNode | null {
    const row = this.db
      .prepare('SELECT id, type, label, meta, updated_at FROM nodes WHERE id = ?')
      .get(id) as
      | { id: string; type: string; label: string; meta: string | null; updated_at: number }
      | undefined
    if (!row) return null
    return rowToNode(row)
  }

  searchNodes(query: string, limit = 30): GraphNode[] {
    if (!query.trim()) return []
    // FTS5: wrap each token in double quotes so operators (-, @, =, *, etc.)
    // are treated as literals; double internal quotes per FTS5 escape rules.
    const ftsQuery = query
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t.replace(/"/g, '""')}"*`)
      .join(' ')
    const rows = this.db
      .prepare(
        `SELECT n.id, n.type, n.label, n.meta, n.updated_at
         FROM nodes_fts f JOIN nodes n ON n.rowid = f.rowid
         WHERE nodes_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(ftsQuery, limit) as Array<{
      id: string
      type: string
      label: string
      meta: string | null
      updated_at: number
    }>
    return rows.map(rowToNode)
  }

  neighbors(
    nodeId: string,
    opts: { relation?: GraphRelation; direction?: 'out' | 'in' | 'both' } = {}
  ): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const direction = opts.direction ?? 'both'
    const params: (string | undefined)[] = []
    const clauses: string[] = []
    if (direction === 'out' || direction === 'both') {
      clauses.push('from_id = ?')
      params.push(nodeId)
    }
    if (direction === 'in' || direction === 'both') {
      clauses.push('to_id = ?')
      params.push(nodeId)
    }
    let where = clauses.join(' OR ')
    if (opts.relation) {
      where = `(${where}) AND relation = ?`
      params.push(opts.relation)
    }
    const edgeRows = this.db
      .prepare(
        `SELECT id, from_id, to_id, relation, weight FROM edges WHERE ${where}`
      )
      .all(...params) as Array<{
      id: string
      from_id: string
      to_id: string
      relation: string
      weight: number
    }>
    const edges: GraphEdge[] = edgeRows.map((e) => ({
      id: e.id,
      fromId: e.from_id,
      toId: e.to_id,
      relation: e.relation as GraphRelation,
      weight: e.weight
    }))
    const ids = new Set<string>()
    for (const e of edges) {
      ids.add(e.fromId)
      ids.add(e.toId)
    }
    if (ids.size === 0) return { nodes: [], edges: [] }
    const placeholders = Array.from(ids).map(() => '?').join(',')
    const nodeRows = this.db
      .prepare(
        `SELECT id, type, label, meta, updated_at FROM nodes WHERE id IN (${placeholders})`
      )
      .all(...Array.from(ids)) as Array<{
      id: string
      type: string
      label: string
      meta: string | null
      updated_at: number
    }>
    return { nodes: nodeRows.map(rowToNode), edges }
  }

  stats(): GraphStats {
    const nc = this.db.prepare('SELECT COUNT(*) AS c FROM nodes').get() as { c: number }
    const ec = this.db.prepare('SELECT COUNT(*) AS c FROM edges').get() as { c: number }
    const m = this.db
      .prepare(`SELECT value FROM meta WHERE key = 'last_indexed_at'`)
      .get() as { value: string } | undefined
    return {
      nodeCount: nc.c,
      edgeCount: ec.c,
      lastIndexedAt: m ? Number(m.value) : null
    }
  }

  setLastIndexedAt(ts: number): void {
    this.db
      .prepare(
        `INSERT INTO meta (key, value) VALUES ('last_indexed_at', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(String(ts))
  }

  close(): void {
    this.db.close()
  }
}

function rowToNode(row: {
  id: string
  type: string
  label: string
  meta: string | null
  updated_at: number
}): GraphNode {
  let meta: Record<string, unknown> = {}
  if (row.meta) {
    try {
      meta = JSON.parse(row.meta) as Record<string, unknown>
    } catch {
      meta = {}
    }
  }
  return {
    id: row.id,
    type: row.type as GraphNode['type'],
    label: row.label,
    meta,
    updatedAt: row.updated_at
  }
}
