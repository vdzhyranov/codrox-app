import { useState, useMemo } from 'react'
import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import { useGraph } from '@renderer/hooks/useGraph'
import { GraphHelpModal } from '@renderer/components/GraphHelpModal'
import type { GraphNodeType, GraphSubgraph, GraphNode as AppGraphNode } from '@shared/types/graph'
import { GraphCanvas, darkTheme } from 'reagraph'
import type { GraphNode as ReaNode, GraphEdge as ReaEdge, InternalGraphNode } from 'reagraph'

const TYPE_COLOR: Record<AppGraphNode['type'], string> = {
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

const CLAUDE_ACCENT = '#f97316'

function isClaudeNode(node: AppGraphNode): boolean {
  return (node.meta as { source?: string } | null)?.source === 'claude'
}

export function GraphPanel(): JSX.Element | null {
  const mainWorkspacePath = useWorkspaceStore((s) => {
    const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)
    return ws?.path ?? null
  })
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search row */}
      <div style={{ display: 'flex', gap: 6, padding: '6px 12px' }}>
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

      {/* Type-filter chips */}
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

      {/* Stats bar */}
      <div style={{ padding: '0 12px 6px', fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>
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
                <span style={{ color: CLAUDE_ACCENT }} title="Authored by Claude via MCP">
                  {stats.claudeNodeCount}n / {stats.claudeEdgeCount}e by Claude
                </span>
              </>
            )}
          </>
        ) : '…'}
      </div>

      {/* reagraph canvas — fills remaining space */}
      <GraphView
        results={results}
        onSelect={loadNeighbors}
        isSearching={isSearching}
        hasQuery={!!query.trim()}
      />

      {helpOpen && <GraphHelpModal onClose={() => setHelpOpen(false)} stats={stats} />}
    </div>
  )
}

interface GraphViewProps {
  results: GraphSubgraph
  onSelect: (nodeId: string) => void
  isSearching: boolean
  hasQuery: boolean
}

const GRAPH_THEME = {
  ...darkTheme,
  canvas: { background: '#0d1117', fog: '#0d1117' as const },
  node: {
    ...darkTheme.node,
    fill: '#7ca0e4',
    activeFill: '#ffffff',
    opacity: 1,
    selectedOpacity: 1,
    inactiveOpacity: 0.25,
    label: {
      color: '#8b9db8',
      stroke: '#0d1117',
      activeColor: '#ffffff',
    },
  },
  edge: {
    ...darkTheme.edge,
    fill: '#2d3748',
    activeFill: '#7ca0e4',
    opacity: 0.8,
    selectedOpacity: 1,
    inactiveOpacity: 0.1,
    label: {
      color: '#4a5568',
      activeColor: '#a0aec0',
    },
  },
  arrow: { fill: '#2d3748', activeFill: '#7ca0e4' },
  ring: { fill: '#4a5568', activeFill: '#7ca0e4' },
}

function GraphView({ results, onSelect, isSearching, hasQuery }: GraphViewProps): JSX.Element {
  const [selections, setSelections] = useState<string[]>([])

  const reaNodes: ReaNode[] = useMemo(
    () =>
      results.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        fill: isClaudeNode(node) ? CLAUDE_ACCENT : TYPE_COLOR[node.type],
        size: isClaudeNode(node) ? 6 : 5,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results.nodes]
  )

  const reaEdges: ReaEdge[] = useMemo(
    () =>
      results.edges.map((edge) => ({
        id: edge.id,
        source: edge.fromId,
        target: edge.toId,
        label: edge.relation,
        fill: edge.source === 'claude' ? CLAUDE_ACCENT : undefined,
        dashed: edge.source === 'claude',
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results.edges]
  )

  const isEmpty = results.nodes.length === 0

  function handleNodeClick(node: InternalGraphNode): void {
    setSelections((prev) => (prev.includes(node.id) ? [] : [node.id]))
    onSelect(node.id)
  }

  return (
    <div style={{ flex: 1, minHeight: 0, padding: '0 8px 8px', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: 6,
          overflow: 'hidden',
          position: 'relative',
          background: '#0d1117',
          border: '1px solid #1e2533',
        }}
      >
        {isEmpty ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: '#4a5568',
            }}
          >
            {isSearching ? 'Searching…' : hasQuery ? 'No matches' : 'Search nodes to explore the graph'}
          </div>
        ) : (
          <GraphCanvas
            nodes={reaNodes}
            edges={reaEdges}
            selections={selections}
            layoutType="forceDirected2d"
            theme={GRAPH_THEME}
            onNodeClick={handleNodeClick}
            onCanvasClick={() => setSelections([])}
          />
        )}
      </div>
    </div>
  )
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
