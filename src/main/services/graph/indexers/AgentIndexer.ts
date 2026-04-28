import { subAgentWatcher, type AgentListEntry, type SubAgentInfo } from '../../SubAgentWatcher'
import { indexTranscript } from './TranscriptIndexer'
import type { GraphEdge, GraphNode } from '@shared/types/graph'

const MAX_TRANSCRIPTS_TO_PARSE = 50

export interface IndexedAgents {
  sessionNodes: GraphNode[]
  workedOnEdges: GraphEdge[]
  fileStubs: GraphNode[]
}

/**
 * Build `agent_session` nodes from on-disk Claude Code task outputs and emit
 * `workedOn` edges by parsing each transcript for workspace file references.
 */
export class AgentIndexer {
  constructor(private workspaceRoot: string) {}

  index(): IndexedAgents {
    const entries = subAgentWatcher.listAgents(this.workspaceRoot)
    const out: IndexedAgents = { sessionNodes: [], workedOnEdges: [], fileStubs: [] }

    for (const entry of entries) {
      out.sessionNodes.push(toSessionNode(entry))
    }

    // Parse only the most recent N transcripts to keep reindex bounded.
    for (const entry of entries.slice(0, MAX_TRANSCRIPTS_TO_PARSE)) {
      const t = indexTranscript(this.workspaceRoot, entry.id, entry.outputPath)
      out.workedOnEdges.push(...t.workedOnEdges)
      out.fileStubs.push(...t.fileStubs)
    }

    return out
  }
}

export function toSessionNode(
  entry: AgentListEntry | (SubAgentInfo & { startedAt?: number })
): GraphNode {
  const startedAt =
    'startedAt' in entry && typeof entry.startedAt === 'number' ? entry.startedAt : Date.now()
  const status = 'status' in entry ? entry.status : 'running'
  return {
    id: `agent:${entry.id}`,
    type: 'agent_session',
    label: entry.task.slice(0, 60) || 'Agent session',
    meta: { agentId: entry.id, task: entry.task, status, startedAt },
    updatedAt: startedAt
  }
}
