import { readdirSync } from 'fs'
import { join } from 'path'

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  '.codrox',
  '.claude',
  'dist',
  'out',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache'
])

const MAX_DEPTH = 12

export function* walkSync(root: string, depth = 0): Generator<string> {
  if (depth > MAX_DEPTH) return
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(root, e.name)
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue
      yield* walkSync(full, depth + 1)
    } else if (e.isFile()) {
      yield full
    }
  }
}
