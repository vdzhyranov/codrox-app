import { useMemo, useState } from 'react'
import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useGraph } from '@renderer/hooks/useGraph'
import { GraphHelpModal } from '@renderer/components/GraphHelpModal'
import type { GraphNode, GraphNodeType, GraphSubgraph } from '@shared/types/graph'

const TYPE_COLOR: Record<GraphNode['type'], string> = {
  file: '#3b82f6',
  symbol: '#a855f7',
  commit: '#22c55e',
  agent_session: '#eab308',
  concept: '#06b6d4'
}

const ALL_TYPES: GraphNodeType[] = ['file', 'symbol', 'commit', 'agent_session', 'concept']

const TYPE_LABEL: Record<GraphNodeType, string> = {
  file: 'File',
  symbol: 'Symbol',
  commit: 'Commit',
  agent_session: 'Agent',
  concept: 'Concept'
}

const CLAUDE_STROKE = '#f97316' // distinguishes Claude-authored nodes/edges

function isClaudeNode(node: GraphNode): boolean {
  return (node.meta as { source?: string } | null)?.source === 'claude'
}

export function GraphPanel(): JSX.Element | null {
  const workspacePath = useActiveWorktreePath()
  const { stats, results, query, setQuery, nodeTypes, setNodeTypes, reindex, loadNeighbors, isIndexing, isSearching } =
    useGraph(workspacePath)
  const [helpOpen, setHelpOpen] = useState(false)

  if (!workspacePath) return null

  function toggleType(t: GraphNodeType): void {
    if (nodeTypes.includes(t)) {
      setNodeTypes(nodeTypes.filter((x) => x !== t))
    } else {
      setNodeTypes([...nodeTypes, t])
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 360 }}>
      <div style={{ display: 'flex', gap: 6, padding: '4px 12px 8px' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes…"
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: 'var(--fs-sm)',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: 3,
            outline: 'none'
          }}
        />
        <button
          onClick={reindex}
          disabled={isIndexing}
          title="Re-index this workspace"
          style={{
            padding: '4px 10px',
            fontSize: 'var(--fs-xs)',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: 'var(--text2)',
            borderRadius: 3,
            cursor: isIndexing ? 'wait' : 'pointer'
          }}
        >
          {isIndexing ? '…' : 'Reindex'}
        </button>
        <button
          onClick={() => setHelpOpen(true)}
          title="What is the knowledge graph?"
          style={{
            width: 24,
            padding: 0,
            fontSize: 'var(--fs-xs)',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: 'var(--text2)',
            borderRadius: 3,
            cursor: 'pointer'
          }}
        >
          ?
        </button>
      </div>

      {/* Type-filter chips + color legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 12px 6px' }}>
        {ALL_TYPES.map((t) => {
          const active = nodeTypes.length === 0 || nodeTypes.includes(t)
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              title={`Toggle ${TYPE_LABEL[t]} nodes`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                fontSize: 'var(--fs-xs)',
                background: active ? 'var(--surface2)' : 'transparent',
                border: `1px solid ${active ? TYPE_COLOR[t] : 'var(--border)'}`,
                color: active ? 'var(--text)' : 'var(--text3)',
                borderRadius: 10,
                cursor: 'pointer',
                opacity: active ? 1 : 0.5
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: TYPE_COLOR[t],
                  flexShrink: 0
                }}
              />
              {TYPE_LABEL[t]}
            </button>
          )
        })}
      </div>

      <div style={{ padding: '0 12px', fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>
        {stats ? (
          <>
            {`${stats.nodeCount} nodes · ${stats.edgeCount} edges${
              stats.lastIndexedAt
                ? ` · indexed ${formatRelative(stats.lastIndexedAt)}`
                : ' · not indexed'
            }`}
            {stats.claudeNodeCount + stats.claudeEdgeCount > 0 && (
              <>
                {' · '}
                <span style={{ color: CLAUDE_STROKE }} title="Authored by Claude via MCP">
                  {stats.claudeNodeCount}n / {stats.claudeEdgeCount}e by Claude
                </span>
              </>
            )}
          </>
        ) : (
          '…'
        )}
      </div>

      <GraphCanvas results={results} onSelect={loadNeighbors} />

      {query && results.nodes.length === 0 && !isSearching && (
        <div style={{ padding: '8px 12px', fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>
          No matches.
        </div>
      )}

      {helpOpen && <GraphHelpModal onClose={() => setHelpOpen(false)} stats={stats} />}
    </div>
  )
}

interface GraphCanvasProps {
  results: GraphSubgraph
  onSelect: (nodeId: string) => void
}

const W = 260
const H = 240

/**
 * Minimal SVG layout: deterministic radial placement of nodes around the first one.
 * Cheap, no animation, no force simulation — good enough to visualize a small subgraph.
 */
function GraphCanvas({ results, onSelect }: GraphCanvasProps): JSX.Element {
  const positioned = useMemo(() => layout(results.nodes), [results.nodes])
  const nodeIndex = useMemo(() => {
    const m = new Map<string, { x: number; y: number; node: GraphNode }>()
    for (const p of positioned) m.set(p.node.id, p)
    return m
  }, [positioned])

  return (
    <div style={{ padding: 8 }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {results.edges.map((e) => {
          const a = nodeIndex.get(e.fromId)
          const b = nodeIndex.get(e.toId)
          if (!a || !b) return null
          const claude = e.source === 'claude'
          return (
            <line
              key={e.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={claude ? CLAUDE_STROKE : 'var(--border)'}
              strokeWidth={claude ? 1.5 : 1}
              strokeDasharray={claude ? '3 2' : undefined}
            >
              <title>
                {e.relation}
                {claude ? ' (Claude)' : ''}
              </title>
            </line>
          )
        })}
        {positioned.map(({ x, y, node }) => {
          const claude = isClaudeNode(node)
          return (
            <g
              key={node.id}
              transform={`translate(${x}, ${y})`}
              onClick={() => onSelect(node.id)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                r={5}
                fill={TYPE_COLOR[node.type]}
                stroke={claude ? CLAUDE_STROKE : 'none'}
                strokeWidth={claude ? 2 : 0}
              />
              {claude && (
                <text
                  x={-2.5}
                  y={2.5}
                  fontSize={6}
                  fontWeight={700}
                  fill="#fff"
                  style={{ pointerEvents: 'none' }}
                >
                  C
                </text>
              )}
              <text
                x={8}
                y={4}
                fontSize={10}
                fill={claude ? CLAUDE_STROKE : 'var(--text2)'}
                style={{ pointerEvents: 'none' }}
              >
                {truncate(node.label, 22)}
              </text>
              <title>
                {node.id}
                {claude ? ' — authored by Claude' : ''}
              </title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function layout(nodes: GraphNode[]): Array<{ x: number; y: number; node: GraphNode }> {
  if (nodes.length === 0) return []
  const cx = W / 2
  const cy = H / 2
  if (nodes.length === 1) return [{ x: cx, y: cy, node: nodes[0] }]
  const radius = Math.min(W, H) / 2 - 30
  const out: Array<{ x: number; y: number; node: GraphNode }> = [{ x: cx, y: cy, node: nodes[0] }]
  const rest = nodes.slice(1)
  for (let i = 0; i < rest.length; i++) {
    const angle = (i / rest.length) * Math.PI * 2
    out.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, node: rest[i] })
  }
  return out
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}

function formatRelative(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
