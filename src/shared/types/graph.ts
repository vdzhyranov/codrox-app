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

export interface GraphEdge {
  id: string
  fromId: string
  toId: string
  relation: GraphRelation
  weight: number
}

export interface GraphSubgraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphStats {
  nodeCount: number
  edgeCount: number
  lastIndexedAt: number | null
}
