import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { GraphEdge, GraphNode } from '@shared/types/graph'

const SOURCE_EXT_RE = /\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|css|html|sql|sh|py|go|rs)$/i
const FILE_REF_RE = /(?:^|[\s(`"'])([\w][\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|css|html|sql|sh|py|go|rs))/g

export interface IndexedConcepts {
  conceptNodes: GraphNode[]
  relatedToEdges: GraphEdge[]
}

/**
 * Parse `<workspaceRoot>/CLAUDE.md` (and `.claude/CLAUDE.md` if present), turn each
 * `## Heading` / `### Heading` into a `concept` node, and link each concept to file
 * paths mentioned in its section via `relatedTo` edges.
 */
export class ConceptIndexer {
  constructor(private workspaceRoot: string) {}

  index(): IndexedConcepts {
    const out: IndexedConcepts = { conceptNodes: [], relatedToEdges: [] }
    const candidates = [
      { path: join(this.workspaceRoot, 'CLAUDE.md'), source: 'CLAUDE.md' },
      { path: join(this.workspaceRoot, '.claude', 'CLAUDE.md'), source: '.claude/CLAUDE.md' }
    ]
    for (const { path, source } of candidates) {
      if (!existsSync(path)) continue
      let text: string
      try {
        text = readFileSync(path, 'utf-8')
      } catch {
        continue
      }
      this.parseInto(text, source, out)
    }
    return out
  }

  private parseInto(text: string, source: string, out: IndexedConcepts): void {
    const lines = text.split('\n')
    let currentConcept: GraphNode | null = null
    const now = Date.now()
    const sourceSlug = slugify(source)

    for (const line of lines) {
      const heading = line.match(/^(#{2,3})\s+(.+?)\s*$/)
      if (heading) {
        const title = heading[2]
        // Namespace by source so the same heading in different files doesn't collide.
        const id = `concept:${sourceSlug}#${slugify(title)}`
        currentConcept = {
          id,
          type: 'concept',
          label: title,
          meta: { source },
          updatedAt: now
        }
        out.conceptNodes.push(currentConcept)
        continue
      }
      if (!currentConcept) continue

      FILE_REF_RE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = FILE_REF_RE.exec(line)) !== null) {
        const filePath = m[1]
        if (!SOURCE_EXT_RE.test(filePath)) continue
        const fileNodeId = `file:${filePath}`
        out.relatedToEdges.push({
          id: `edge:${currentConcept.id}->${fileNodeId}:relatedTo`,
          fromId: currentConcept.id,
          toId: fileNodeId,
          relation: 'relatedTo',
          weight: 1
        })
      }
    }
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
