import { readFileSync, statSync } from 'fs'
import { dirname, extname, join, relative, resolve, sep } from 'path'
import { walkSync } from '../walk'
import { extractSymbols } from './SymbolIndexer'
import type { GraphEdge, GraphNode } from '@shared/types/graph'

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const RESOLUTION_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js']
const MAX_FILE_BYTES = 512 * 1024

/** Extract `from '...'` and `require('...')` specifiers from source text. */
const IMPORT_RE = /(?:^|\s)(?:import\s[^'"`]*?from\s*|import\s*|export\s[^'"`]*?from\s*|require\s*\()\s*['"`]([^'"`]+)['"`]/g

export interface IndexedFile {
  fileNode: GraphNode
  importEdges: GraphEdge[]
  importedFileNodes: GraphNode[]
  symbolNodes: GraphNode[]
  defineEdges: GraphEdge[]
}

export class FileIndexer {
  constructor(private workspaceRoot: string) {}

  /** Index a single file. Returns nothing if the file isn't an indexable source file. */
  indexFile(absPath: string): IndexedFile | null {
    if (!SOURCE_EXTS.has(extname(absPath))) return null
    let stat
    try {
      stat = statSync(absPath)
    } catch {
      return null
    }
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null

    let text: string
    try {
      text = readFileSync(absPath, 'utf-8')
    } catch {
      return null
    }

    const rel = relative(this.workspaceRoot, absPath)
    const fileNode: GraphNode = {
      id: fileId(rel),
      type: 'file',
      label: rel.split(sep).pop() ?? rel,
      meta: { path: rel, size: stat.size, language: langFromExt(extname(absPath)) },
      updatedAt: Date.now()
    }

    const importEdges: GraphEdge[] = []
    const importedFileNodes: GraphNode[] = []
    const dir = dirname(absPath)

    for (const spec of extractImports(text)) {
      // Skip non-relative (npm) imports for now — phase 1 focuses on intra-repo edges.
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue
      const resolved = resolveImport(dir, spec)
      if (!resolved) continue
      const relTo = relative(this.workspaceRoot, resolved)
      // Don't link outside the workspace
      if (relTo.startsWith('..')) continue
      const toId = fileId(relTo)
      importedFileNodes.push({
        id: toId,
        type: 'file',
        label: relTo.split(sep).pop() ?? relTo,
        meta: { path: relTo },
        updatedAt: Date.now()
      })
      importEdges.push({
        id: `edge:${fileNode.id}->${toId}:imports`,
        fromId: fileNode.id,
        toId,
        relation: 'imports',
        weight: 1
      })
    }

    const { symbolNodes, defineEdges } = extractSymbols(fileNode.id, rel, text)

    return { fileNode, importEdges, importedFileNodes, symbolNodes, defineEdges }
  }

  /** Walk the workspace and yield each indexable source file's absolute path. */
  *walk(): Generator<string> {
    for (const p of walkSync(this.workspaceRoot)) {
      if (SOURCE_EXTS.has(extname(p))) yield p
    }
  }

  /** Compute the node ID for a file at the given absolute path. */
  idForAbs(absPath: string): string | null {
    const rel = relative(this.workspaceRoot, absPath)
    if (rel.startsWith('..')) return null
    return fileId(rel)
  }
}

function extractImports(text: string): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  IMPORT_RE.lastIndex = 0
  while ((m = IMPORT_RE.exec(text)) !== null) out.push(m[1])
  return out
}

function resolveImport(fromDir: string, spec: string): string | null {
  const base = resolve(fromDir, spec)
  for (const ext of RESOLUTION_EXTS) {
    const candidate = ext.startsWith('/') ? join(base, ext.slice(1)) : `${base}${ext}`
    try {
      const s = statSync(candidate)
      if (s.isFile()) return candidate
    } catch {
      // try next extension
    }
  }
  // Bare path that already includes extension
  try {
    const s = statSync(base)
    if (s.isFile()) return base
  } catch {
    // no match
  }
  return null
}

function fileId(relPath: string): string {
  return `file:${relPath.split(sep).join('/')}`
}

function langFromExt(ext: string): string {
  switch (ext) {
    case '.ts':
    case '.tsx':
      return 'typescript'
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'javascript'
    default:
      return 'unknown'
  }
}
