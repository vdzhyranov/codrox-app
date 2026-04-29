import { useMemo, useState } from 'react'
import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import { useGraph } from '@renderer/hooks/useGraph'
import { GraphHelpModal } from '@renderer/components/GraphHelpModal'
import type { GraphEdge, GraphNode, GraphNodeType, GraphSubgraph } from '@shared/types/graph'

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

const CLAUDE_STROKE = '#f97316'

function isClaudeNode(node: GraphNode): boolean {
  return (node.meta as { source?: string } | null)?.source === 'claude'
}

export function GraphPanel(): JSX.Element | null {
  // Use the main workspace path as the DB key so all worktrees share one graph.
  const mainWorkspacePath = useWorkspaceStore((s) => {
    const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)
    return ws?.path ?? null
  })
  // Pass the active worktree path so reindex scans the right branch.
  const activeWorktreePath = useActiveWorktreePath()
  const { stats, results, query, setQuery, nodeTypes, setNodeTypes, reindex, loadNeighbors, isIndexing, isSearching } =
    useGraph(mainWorkspacePath, activeWorktreePath)
  const [helpOpen, setHelpOpen] = useState(false)

  if (!mainWorkspacePath) return null

  function toggleType(t: GraphNodeType): void {
    if (nodeTypes.includes(t)) {
      setNodeTypes(nodeTypes.filter((x) => x !== t))
    } else {
      setNodeTypes([...nodeTypes, t])
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 420 }}>
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

      <div style={{ padding: '0 12px 4px', fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>
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

      <GraphCanvas
        results={results}
        onSelect={loadNeighbors}
        isSearching={isSearching}
        hasQuery={!!query.trim()}
      />

      {helpOpen && <GraphHelpModal onClose={() => setHelpOpen(false)} stats={stats} />}
    </div>
  )
}

interface GraphCanvasProps {
  results: GraphSubgraph
  onSelect: (nodeId: string) => void
  isSearching: boolean
  hasQuery: boolean
}

const W = 320
const H = 300
const NODE_R = 7
const ARROW = 7

function GraphCanvas({ results, onSelect, isSearching, hasQuery }: GraphCanvasProps): JSX.Element {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const positioned = useMemo(
    () => forceLayout(results.nodes, results.edges),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results.nodes, results.edges]
  )
  const nodeIndex = useMemo(() => {
    const m = new Map<string, { x: number; y: number; node: GraphNode }>()
    for (const p of positioned) m.set(p.node.id, p)
    return m
  }, [positioned])

  function handleNodeClick(nodeId: string): void {
    setSelectedNode(nodeId === selectedNode ? null : nodeId)
    onSelect(nodeId)
  }

  const isEmpty = results.nodes.length === 0

  return (
    <div style={{ padding: '4px 8px 8px' }}>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', background: 'var(--surface1)', borderRadius: 4 }}
      >
        <defs>
          <marker id="kg-arr" markerWidth={ARROW} markerHeight={ARROW} refX={ARROW} refY={ARROW / 2} orient="auto" markerUnits="userSpaceOnUse">
            <path d={`M0,1 L${ARROW},${ARROW / 2} L0,${ARROW - 1} z`} fill="var(--border)" />
          </marker>
          <marker id="kg-arr-c" markerWidth={ARROW} markerHeight={ARROW} refX={ARROW} refY={ARROW / 2} orient="auto" markerUnits="userSpaceOnUse">
            <path d={`M0,1 L${ARROW},${ARROW / 2} L0,${ARROW - 1} z`} fill={CLAUDE_STROKE} />
          </marker>
          <marker id="kg-arr-h" markerWidth={ARROW} markerHeight={ARROW} refX={ARROW} refY={ARROW / 2} orient="auto" markerUnits="userSpaceOnUse">
            <path d={`M0,1 L${ARROW},${ARROW / 2} L0,${ARROW - 1} z`} fill="var(--text2)" />
          </marker>
        </defs>

        {isEmpty && (
          <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="var(--text3)">
            {isSearching ? 'Searching…' : hasQuery ? 'No matches' : 'Search nodes to explore the graph'}
          </text>
        )}

        {/* Edges — drawn before nodes so nodes sit on top */}
        {results.edges.map((e) => {
          const a = nodeIndex.get(e.fromId)
          const b = nodeIndex.get(e.toId)
          if (!a || !b) return null
          const claude = e.source === 'claude'
          const hovered = hoveredEdge === e.id
          const pts = edgeEndpoints(a.x, a.y, b.x, b.y)
          const midX = (pts.x1 + pts.x2) / 2
          const midY = (pts.y1 + pts.y2) / 2

          return (
            <g key={e.id}>
              {/* Wide invisible hit zone */}
              <line x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2} stroke="transparent" strokeWidth={12} onMouseEnter={() => setHoveredEdge(e.id)} onMouseLeave={() => setHoveredEdge(null)} />
              <line
                x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
                stroke={hovered ? 'var(--text2)' : claude ? CLAUDE_STROKE : 'var(--border)'}
                strokeWidth={hovered ? 1.5 : claude ? 1.5 : 1}
                strokeDasharray={!hovered && claude ? '4 2' : undefined}
                markerEnd={hovered ? 'url(#kg-arr-h)' : claude ? 'url(#kg-arr-c)' : 'url(#kg-arr)'}
                style={{ pointerEvents: 'none' }}
              />
              {/* Relation label shown on hover */}
              {hovered && (() => {
                const lw = e.relation.length * 5.2 + 10
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect x={midX - lw / 2} y={midY - 8} width={lw} height={14} rx={3} fill="var(--surface2)" stroke="var(--border)" strokeWidth={0.5} />
                    <text x={midX} y={midY + 1} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="var(--text2)">{e.relation}</text>
                  </g>
                )
              })()}
            </g>
          )
        })}

        {/* Nodes — labels shown only on hover/select to avoid clutter */}
        {positioned.map(({ x, y, node }) => {
          const claude = isClaudeNode(node)
          const hovered = hoveredNode === node.id
          const selected = selectedNode === node.id
          const r = NODE_R + (hovered || selected ? 2 : 0)
          // Tooltip label: clamp to canvas edges
          const label = node.label
          const lw = Math.min(label.length * 5.8 + 12, 160)
          const labelRight = x + lw + NODE_R + 6 <= W
          const tooltipX = labelRight ? NODE_R + 6 : -(NODE_R + 6) - lw
          // Clamp tooltip vertically
          const tooltipY = y - 9 < 0 ? NODE_R + 6 : -NODE_R - 18

          return (
            <g
              key={node.id}
              transform={`translate(${x}, ${y})`}
              onClick={() => handleNodeClick(node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Selection ring */}
              {selected && <circle r={r + 5} fill="none" stroke={TYPE_COLOR[node.type]} strokeWidth={1.5} opacity={0.35} />}
              <circle
                r={r}
                fill={TYPE_COLOR[node.type]}
                stroke={claude ? CLAUDE_STROKE : hovered || selected ? 'rgba(255,255,255,0.8)' : 'none'}
                strokeWidth={claude ? 2 : hovered || selected ? 1.5 : 0}
              />
              {/* "C" badge for Claude-authored nodes */}
              {claude && (
                <text x={-2.5} y={2.5} fontSize={6} fontWeight={700} fill="#fff" style={{ pointerEvents: 'none' }}>C</text>
              )}
              {/* Hover / selected tooltip label */}
              {(hovered || selected) && (
                <g style={{ pointerEvents: 'none' }} transform={`translate(${tooltipX}, ${tooltipY})`}>
                  <rect x={0} y={0} width={lw} height={16} rx={3} fill="var(--surface2)" stroke={selected ? TYPE_COLOR[node.type] : 'var(--border)'} strokeWidth={selected ? 1 : 0.5} />
                  <text x={lw / 2} y={8} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={claude ? CLAUDE_STROKE : 'var(--text)'} fontWeight={selected ? 600 : 400}>
                    {truncate(label, 26)}
                  </text>
                </g>
              )}
              <title>{`[${node.type}] ${node.id}`}{claude ? ' — authored by Claude' : ''}</title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function edgeEndpoints(
  x1: number, y1: number, x2: number, y2: number
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / dist
  const uy = dy / dist
  return {
    x1: x1 + ux * NODE_R,
    y1: y1 + uy * NODE_R,
    x2: x2 - ux * NODE_R,
    y2: y2 - uy * NODE_R
  }
}

function forceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Array<{ x: number; y: number; node: GraphNode }> {
  if (nodes.length === 0) return []
  const cx = W / 2
  const cy = H / 2
  if (nodes.length === 1) return [{ x: cx, y: cy, node: nodes[0] }]

  const pos = new Map<string, { x: number; y: number }>()
  const radius = Math.min(W, H) / 2 - 30
  for (let i = 0; i < nodes.length; i++) {
    const angle = (i / nodes.length) * Math.PI * 2
    pos.set(nodes[i].id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius })
  }

  const vel = new Map<string, { vx: number; vy: number }>()
  for (const n of nodes) vel.set(n.id, { vx: 0, vy: 0 })

  const REPULSION = 3500
  const SPRING_K = 0.03
  const IDEAL_LEN = 90
  const GRAVITY = 0.008
  const DAMPING = 0.75
  const ITERS = 80
  const PAD = NODE_R + 6

  for (let iter = 0; iter < ITERS; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>()
    for (const n of nodes) forces.set(n.id, { fx: 0, fy: 0 })

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos.get(nodes[i].id)!
        const b = pos.get(nodes[j].id)!
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1
        const f = REPULSION / (dist * dist)
        const fx = (dx / dist) * f
        const fy = (dy / dist) * f
        forces.get(nodes[i].id)!.fx -= fx
        forces.get(nodes[i].id)!.fy -= fy
        forces.get(nodes[j].id)!.fx += fx
        forces.get(nodes[j].id)!.fy += fy
      }
    }

    for (const e of edges) {
      const a = pos.get(e.fromId)
      const b = pos.get(e.toId)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1
      const f = SPRING_K * (dist - IDEAL_LEN)
      const fx = (dx / dist) * f
      const fy = (dy / dist) * f
      const fa = forces.get(e.fromId)
      const fb = forces.get(e.toId)
      if (fa) { fa.fx += fx; fa.fy += fy }
      if (fb) { fb.fx -= fx; fb.fy -= fy }
    }

    for (const n of nodes) {
      const p = pos.get(n.id)!
      const f = forces.get(n.id)!
      f.fx += (cx - p.x) * GRAVITY
      f.fy += (cy - p.y) * GRAVITY
    }

    for (const n of nodes) {
      const f = forces.get(n.id)!
      const v = vel.get(n.id)!
      v.vx = (v.vx + f.fx) * DAMPING
      v.vy = (v.vy + f.fy) * DAMPING
      const p = pos.get(n.id)!
      p.x = Math.max(PAD, Math.min(W - PAD, p.x + v.vx))
      p.y = Math.max(PAD, Math.min(H - PAD, p.y + v.vy))
    }
  }

  return nodes.map((n) => ({ ...pos.get(n.id)!, node: n }))
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
