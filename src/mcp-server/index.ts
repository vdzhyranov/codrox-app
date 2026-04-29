/**
 * codrox-graph-mcp — stdio MCP server exposing the per-workspace knowledge graph
 * to Claude Code. Spawned by Claude via .claude/.mcp.json with --workspace <abs>.
 *
 * Reads + writes against `<workspace>/.codrox/knowledge.db` (the same file the
 * Codrox app indexes into). WAL mode keeps the two processes safe to share.
 *
 * All Claude-authored writes stamp `source='claude'` on edges and `meta.source='claude'`
 * on new nodes so reindex doesn't wipe them.
 */
import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import { join } from 'path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

/**
 * Must match `GRAPH_SCHEMA_VERSION` in src/main/services/graph/GraphStore.ts.
 * Bumped together; mismatch means the bundled MCP and the live app disagree
 * about the on-disk shape, so we refuse to attach rather than corrupt the graph.
 */
const EXPECTED_SCHEMA_VERSION = 3

interface NodeRow {
  id: string
  type: string
  label: string
  meta: string | null
  updated_at: number
}
interface EdgeRow {
  id: string
  from_id: string
  to_id: string
  relation: string
  weight: number
  source: string
}

function parseArgs(): { workspace: string } {
  const args = process.argv.slice(2)
  const idx = args.indexOf('--workspace')
  if (idx === -1 || !args[idx + 1]) {
    process.stderr.write('codrox-graph-mcp: missing --workspace <absolute-path>\n')
    process.exit(1)
  }
  return { workspace: args[idx + 1] }
}

function parseMeta(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function rowToNode(row: NodeRow): {
  id: string
  type: string
  label: string
  meta: Record<string, unknown>
  updatedAt: number
} {
  return { id: row.id, type: row.type, label: row.label, meta: parseMeta(row.meta), updatedAt: row.updated_at }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

const { workspace } = parseArgs()
const dbPath = join(workspace, '.codrox', 'knowledge.db')

if (!existsSync(dbPath)) {
  process.stderr.write(
    `codrox-graph-mcp: no graph at ${dbPath}. Open the workspace in Codrox and run reindex.\n`
  )
  process.exit(1)
}

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 5000')
db.pragma('foreign_keys = ON')

// Schema-version handshake. If the live DB was written by an older Codrox build,
// the user must reopen the workspace so GraphStore.migrate() runs.
{
  const row = db
    .prepare(`SELECT value FROM meta WHERE key = 'schema_version'`)
    .get() as { value: string } | undefined
  const found = row ? Number(row.value) : null
  if (!found || found !== EXPECTED_SCHEMA_VERSION) {
    process.stderr.write(
      `codrox-graph-mcp: schema version mismatch (db=${found ?? 'unset'}, expected=${EXPECTED_SCHEMA_VERSION}). ` +
        `Reopen the workspace in Codrox to run migrations, then restart Claude.\n`
    )
    process.exit(1)
  }
}

/**
 * Relations Claude is allowed to assert. We deliberately exclude indexer-derived
 * relations (`imports`, `defines`, `modifiedBy`, `workedOn`) so Claude can't
 * pollute the parsed-from-source view with unverified claims.
 */
const CLAUDE_RELATIONS = ['calls', 'relatedTo'] as const
type ClaudeRelation = (typeof CLAUDE_RELATIONS)[number]

const ALL_RELATIONS = ['imports', 'defines', 'calls', 'modifiedBy', 'workedOn', 'relatedTo'] as const

function searchNodes(query: string, limit: number): ReturnType<typeof rowToNode>[] {
  if (!query.trim()) return []
  const fts = query
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"*`)
    .join(' ')
  const rows = db
    .prepare(
      `SELECT n.id, n.type, n.label, n.meta, n.updated_at
       FROM nodes_fts f JOIN nodes n ON n.rowid = f.rowid
       WHERE nodes_fts MATCH ? ORDER BY rank LIMIT ?`
    )
    .all(fts, limit) as NodeRow[]
  return rows.map(rowToNode)
}

function getNode(id: string): ReturnType<typeof rowToNode> | null {
  const row = db
    .prepare(`SELECT id, type, label, meta, updated_at FROM nodes WHERE id = ?`)
    .get(id) as NodeRow | undefined
  return row ? rowToNode(row) : null
}

function neighbors(
  id: string,
  relation: (typeof ALL_RELATIONS)[number] | undefined,
  direction: 'in' | 'out' | 'both'
): {
  center: ReturnType<typeof rowToNode> | null
  nodes: ReturnType<typeof rowToNode>[]
  edges: Array<{ id: string; fromId: string; toId: string; relation: string; weight: number; source: string }>
} {
  const params: (string | number)[] = []
  const clauses: string[] = []
  if (direction === 'out' || direction === 'both') {
    clauses.push('from_id = ?')
    params.push(id)
  }
  if (direction === 'in' || direction === 'both') {
    clauses.push('to_id = ?')
    params.push(id)
  }
  let where = clauses.join(' OR ')
  if (relation) {
    where = `(${where}) AND relation = ?`
    params.push(relation)
  }
  const edgeRows = db
    .prepare(`SELECT id, from_id, to_id, relation, weight, source FROM edges WHERE ${where}`)
    .all(...params) as EdgeRow[]
  const ids = new Set<string>()
  for (const e of edgeRows) {
    ids.add(e.from_id)
    ids.add(e.to_id)
  }
  const center = getNode(id)
  if (ids.size === 0) return { center, nodes: [], edges: [] }
  const placeholders = Array.from(ids).map(() => '?').join(',')
  const nodeRows = db
    .prepare(`SELECT id, type, label, meta, updated_at FROM nodes WHERE id IN (${placeholders})`)
    .all(...Array.from(ids)) as NodeRow[]
  return {
    center,
    nodes: nodeRows.map(rowToNode),
    edges: edgeRows.map((e) => ({
      id: e.id,
      fromId: e.from_id,
      toId: e.to_id,
      relation: e.relation,
      weight: e.weight,
      source: e.source
    }))
  }
}

function stats(): {
  nodeCount: number
  edgeCount: number
  edgesByClaudeCount: number
  nodesByClaudeCount: number
  lastIndexedAt: number | null
  schemaVersion: number
  workspace: string
} {
  const nc = db.prepare('SELECT COUNT(*) AS c FROM nodes').get() as { c: number }
  const ec = db.prepare('SELECT COUNT(*) AS c FROM edges').get() as { c: number }
  const claudeEdges = db
    .prepare(`SELECT COUNT(*) AS c FROM edges WHERE source = 'claude'`)
    .get() as { c: number }
  const claudeNodes = db
    .prepare(`SELECT COUNT(*) AS c FROM nodes WHERE meta LIKE '%"source":"claude"%'`)
    .get() as { c: number }
  const m = db
    .prepare(`SELECT value FROM meta WHERE key = 'last_indexed_at'`)
    .get() as { value: string } | undefined
  return {
    nodeCount: nc.c,
    edgeCount: ec.c,
    edgesByClaudeCount: claudeEdges.c,
    nodesByClaudeCount: claudeNodes.c,
    lastIndexedAt: m ? Number(m.value) : null,
    schemaVersion: EXPECTED_SCHEMA_VERSION,
    workspace
  }
}

const upsertNodeStmt = db.prepare(
  `INSERT INTO nodes (id, type, label, meta, updated_at)
   VALUES (?, ?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET
     type = excluded.type,
     label = excluded.label,
     meta = excluded.meta,
     updated_at = excluded.updated_at`
)

const upsertEdgeStmt = db.prepare(
  `INSERT INTO edges (id, from_id, to_id, relation, weight, source)
   VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT(from_id, to_id, relation) DO UPDATE SET
     weight = excluded.weight,
     source = excluded.source`
)

function addClaudeConcept(
  name: string,
  description: string | undefined,
  relatedFileIds: string[]
): {
  node: ReturnType<typeof rowToNode>
  linkedFileIds: string[]
  skippedFileIds: string[]
} {
  if (!name.trim()) throw new Error('graph_add_concept: name is required')
  const id = `concept:claude#${slugify(name)}`
  if (!id.startsWith('concept:claude#') || id === 'concept:claude#') {
    throw new Error('graph_add_concept: name slug is empty after normalization')
  }
  const now = Date.now()
  const meta: Record<string, unknown> = { source: 'claude' }
  if (description) meta.description = description

  const linkedFileIds: string[] = []
  const skippedFileIds: string[] = []

  const tx = db.transaction(() => {
    upsertNodeStmt.run(id, 'concept', name, JSON.stringify(meta), now)
    for (const fid of relatedFileIds) {
      // FK would reject silently for missing nodes; check first so we can report.
      const exists = db.prepare('SELECT 1 FROM nodes WHERE id = ?').get(fid) as { 1: number } | undefined
      if (!exists) {
        skippedFileIds.push(fid)
        continue
      }
      upsertEdgeStmt.run(`edge:${id}->${fid}:relatedTo`, id, fid, 'relatedTo', 1, 'claude')
      linkedFileIds.push(fid)
    }
  })
  tx()

  const node = getNode(id)
  if (!node) throw new Error(`graph_add_concept: failed to read back ${id} after write`)
  return { node, linkedFileIds, skippedFileIds }
}

function linkClaude(
  fromId: string,
  toId: string,
  relation: ClaudeRelation,
  weight: number
): { edgeId: string } {
  if (fromId === toId) throw new Error('graph_link: fromId and toId must differ')
  const fromExists = db.prepare('SELECT 1 FROM nodes WHERE id = ?').get(fromId)
  if (!fromExists) throw new Error(`graph_link: node not found: ${fromId}`)
  const toExists = db.prepare('SELECT 1 FROM nodes WHERE id = ?').get(toId)
  if (!toExists) throw new Error(`graph_link: node not found: ${toId}`)
  const edgeId = `edge:${fromId}->${toId}:${relation}`
  upsertEdgeStmt.run(edgeId, fromId, toId, relation, weight, 'claude')
  return { edgeId }
}

function annotateNode(
  nodeId: string,
  note: string
): { node: ReturnType<typeof rowToNode>; noteCount: number } {
  const trimmed = note.trim()
  if (!trimmed) throw new Error('graph_annotate: note is required')
  const row = db
    .prepare('SELECT id, type, label, meta, updated_at FROM nodes WHERE id = ?')
    .get(nodeId) as NodeRow | undefined
  if (!row) throw new Error(`graph_annotate: node not found: ${nodeId}`)
  const meta = parseMeta(row.meta)
  const existingNotes = Array.isArray(meta.notes) ? (meta.notes as unknown[]).map(String) : []
  const notes = [...existingNotes, `[${new Date().toISOString()}] ${trimmed}`]
  meta.notes = notes
  // Don't overwrite the original source: notes are additive.
  const now = Date.now()
  db.prepare('UPDATE nodes SET meta = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(meta),
    now,
    nodeId
  )
  const updated = getNode(nodeId)
  if (!updated) throw new Error(`graph_annotate: failed to read back ${nodeId}`)
  return { node: updated, noteCount: notes.length }
}

const server = new McpServer({ name: 'codrox-graph', version: '0.2.0' })

server.registerTool(
  'graph_search',
  {
    description:
      'Search the workspace knowledge graph by free text. Returns matching nodes (files, symbols, commits, agent_session, concept) ranked by FTS5 relevance. Use this to discover anchors before traversing.',
    inputSchema: {
      query: z.string().describe('Search terms. Tokens are AND-combined with prefix match.'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results (default 30).')
    }
  },
  async ({ query, limit }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(searchNodes(query, limit ?? 30), null, 2)
      }
    ]
  })
)

server.registerTool(
  'graph_get_node',
  {
    description: 'Fetch a single node by id (e.g. "file:src/foo.ts", "sym:src/foo.ts#bar").',
    inputSchema: { id: z.string() }
  },
  async ({ id }) => ({
    content: [{ type: 'text', text: JSON.stringify(getNode(id), null, 2) }]
  })
)

server.registerTool(
  'graph_neighbors',
  {
    description:
      '1-hop neighbors of a node, optionally filtered by relation and direction. Use after graph_search to expand context.',
    inputSchema: {
      id: z.string(),
      relation: z.enum(ALL_RELATIONS).optional(),
      direction: z.enum(['in', 'out', 'both']).optional()
    }
  },
  async ({ id, relation, direction }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(neighbors(id, relation, direction ?? 'both'), null, 2)
      }
    ]
  })
)

server.registerTool(
  'graph_stats',
  {
    description:
      'Counts of nodes and edges plus the last reindex timestamp and Claude-authored counters for this workspace.',
    inputSchema: {}
  },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(stats(), null, 2) }]
  })
)

server.registerTool(
  'graph_add_concept',
  {
    description:
      'Capture a domain concept as a Claude-authored node (id `concept:claude#<slug>`) and optionally link it to existing files via `relatedTo`. Use this to record names, terms, or patterns you discovered while reading the codebase. Survives reindex.',
    inputSchema: {
      name: z.string().min(1).describe('Concept label (e.g. "Worktree spawning flow").'),
      description: z
        .string()
        .optional()
        .describe('Short prose explanation stored in `meta.description`.'),
      relatedFileIds: z
        .array(z.string())
        .optional()
        .describe(
          'Node ids of files this concept relates to (e.g. ["file:src/foo.ts"]). Missing nodes are skipped and reported.'
        )
    }
  },
  async ({ name, description, relatedFileIds }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(addClaudeConcept(name, description, relatedFileIds ?? []), null, 2)
      }
    ]
  })
)

server.registerTool(
  'graph_link',
  {
    description:
      'Assert a `calls` or `relatedTo` edge between two existing nodes. Stamped `source=claude`. Indexer-derived relations (imports/defines/modifiedBy/workedOn) are not allowed here — they should come from parsing.',
    inputSchema: {
      fromId: z.string(),
      toId: z.string(),
      relation: z.enum(CLAUDE_RELATIONS),
      weight: z.number().positive().max(10).optional()
    }
  },
  async ({ fromId, toId, relation, weight }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(linkClaude(fromId, toId, relation, weight ?? 1), null, 2)
      }
    ]
  })
)

server.registerTool(
  'graph_annotate',
  {
    description:
      'Append a timestamped note to a node\'s `meta.notes[]`. Use this to record observations on indexer-owned nodes (files, symbols) without overwriting their parsed metadata. Notes survive reindex.',
    inputSchema: {
      nodeId: z.string(),
      note: z.string().min(1)
    }
  },
  async ({ nodeId, note }) => ({
    content: [{ type: 'text', text: JSON.stringify(annotateNode(nodeId, note), null, 2) }]
  })
)

const transport = new StdioServerTransport()
server.connect(transport).catch((err: unknown) => {
  process.stderr.write(`codrox-graph-mcp: failed to connect transport: ${String(err)}\n`)
  process.exit(1)
})
