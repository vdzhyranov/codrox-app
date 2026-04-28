import type { GraphEdge, GraphNode } from '@shared/types/graph'

/**
 * Regex-based symbol extraction. Catches top-level declarations only — good enough
 * for MVP code navigation. A future iteration can swap in tree-sitter for accuracy.
 */
const PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: 'function', re: /^[ \t]*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/gm },
  { kind: 'class',    re: /^[ \t]*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/gm },
  { kind: 'interface',re: /^[ \t]*(?:export\s+)?interface\s+(\w+)/gm },
  { kind: 'type',     re: /^[ \t]*(?:export\s+)?type\s+(\w+)\s*=/gm },
  { kind: 'const',    re: /^[ \t]*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[:=]/gm }
]

export interface ExtractedSymbols {
  symbolNodes: GraphNode[]
  defineEdges: GraphEdge[]
}

/** Extract symbols defined in `text` (already-loaded file) belonging to file `fileNodeId`. */
export function extractSymbols(
  fileNodeId: string,
  filePath: string,
  text: string
): ExtractedSymbols {
  const symbolNodes: GraphNode[] = []
  const defineEdges: GraphEdge[] = []
  const seen = new Set<string>()
  const now = Date.now()

  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const name = m[1]
      const symId = `sym:${filePath}#${name}`
      if (seen.has(symId)) continue
      seen.add(symId)
      const line = lineNumberAt(text, m.index)
      symbolNodes.push({
        id: symId,
        type: 'symbol',
        label: name,
        meta: { kind, file: filePath, line },
        updatedAt: now
      })
      defineEdges.push({
        id: `edge:${fileNodeId}->${symId}:defines`,
        fromId: fileNodeId,
        toId: symId,
        relation: 'defines',
        weight: 1
      })
    }
  }

  return { symbolNodes, defineEdges }
}

function lineNumberAt(text: string, idx: number): number {
  let line = 1
  for (let i = 0; i < idx && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++
  }
  return line
}
