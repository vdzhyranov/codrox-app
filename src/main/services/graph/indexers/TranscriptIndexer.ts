import { closeSync, openSync, readFileSync, readSync, statSync } from 'fs'
import { sep } from 'path'
import type { GraphEdge, GraphNode } from '@shared/types/graph'

const MAX_TRANSCRIPT_BYTES = 2 * 1024 * 1024
const SOURCE_EXT_RE = /\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|mdx|css|scss|html|sql|sh|py|go|rs|java|rb|toml|yaml|yml)$/i

export interface TranscriptResult {
  workedOnEdges: GraphEdge[]
  fileStubs: GraphNode[]
}

/**
 * Scan an agent's `.output` transcript and emit `workedOn` edges from each
 * referenced workspace file to the given agent_session node.
 *
 * We use a workspace-rooted regex rather than parsing the JSONL because tool
 * call shapes vary across Claude versions; matching absolute path strings is
 * forgiving and catches both tool inputs and the agent's prose mentions.
 */
export function indexTranscript(
  workspaceRoot: string,
  agentId: string,
  outputPath: string
): TranscriptResult {
  const result: TranscriptResult = { workedOnEdges: [], fileStubs: [] }
  let stat
  try {
    stat = statSync(outputPath)
  } catch {
    return result
  }
  if (!stat.isFile() || stat.size === 0) return result
  // Read at most MAX_TRANSCRIPT_BYTES off the front of the file so oversized
  // transcripts don't blow up memory before being truncated.
  let text: string
  if (stat.size > MAX_TRANSCRIPT_BYTES) {
    const buf = Buffer.allocUnsafe(MAX_TRANSCRIPT_BYTES)
    let fd: number
    try {
      fd = openSync(outputPath, 'r')
    } catch {
      return result
    }
    try {
      const bytesRead = readSync(fd, buf, 0, MAX_TRANSCRIPT_BYTES, 0)
      text = buf.slice(0, bytesRead).toString('utf-8')
    } finally {
      closeSync(fd)
    }
  } else {
    text = readFileSync(outputPath, 'utf-8')
  }

  const sessionId = `agent:${agentId}`
  const seen = new Set<string>()
  const re = new RegExp(`${escapeRegex(workspaceRoot)}/([^"'\\s\\\\]+)`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const candidate = m[1]
    if (!SOURCE_EXT_RE.test(candidate)) continue
    if (seen.has(candidate)) continue
    seen.add(candidate)
    const fileNodeId = `file:${candidate.split(sep).join('/')}`
    result.fileStubs.push({
      id: fileNodeId,
      type: 'file',
      label: candidate.split('/').pop() ?? candidate,
      meta: { path: candidate },
      updatedAt: stat.mtimeMs
    })
    result.workedOnEdges.push({
      id: `edge:${fileNodeId}->${sessionId}:workedOn`,
      fromId: fileNodeId,
      toId: sessionId,
      relation: 'workedOn',
      weight: 1
    })
  }

  return result
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
