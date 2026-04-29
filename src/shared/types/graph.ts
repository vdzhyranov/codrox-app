export type GraphNodeType = 'file' | 'symbol' | 'commit' | 'agent_session' | 'concept'

export type GraphRelation =
  | 'imports'
  | 'defines'
  | 'calls'
  | 'modifiedBy'
  | 'workedOn'
  | 'relatedTo'

export interface GraphNode {
  id: string
  type: GraphNodeType
  label: string
  meta: Record<string, unknown>
  updatedAt: number
}

export type GraphSource = 'indexer' | 'claude'

export interface GraphEdge {
  id: string
  fromId: string
  toId: string
  relation: GraphRelation
  weight: number
  /** Who authored this edge. Defaults to 'indexer' when omitted at write time. */
  source?: GraphSource
}

export interface GraphSubgraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphStats {
  nodeCount: number
  edgeCount: number
  lastIndexedAt: number | null
  /** Subset of nodeCount whose `meta.source === 'claude'`. */
  claudeNodeCount: number
  /** Subset of edgeCount whose `source === 'claude'`. */
  claudeEdgeCount: number
}
