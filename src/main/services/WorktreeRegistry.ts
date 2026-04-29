import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const REGISTRY_FILE = 'codrox-worktrees.json'

function registryPath(gitCommonDir: string): string {
  return join(gitCommonDir, REGISTRY_FILE)
}

export function getManagedPaths(gitCommonDir: string): Set<string> {
  const file = registryPath(gitCommonDir)
  if (!existsSync(file)) return new Set()
  try {
    const data = JSON.parse(readFileSync(file, 'utf-8')) as unknown
    return new Set(Array.isArray(data) ? (data as string[]) : [])
  } catch {
    return new Set()
  }
}

export function addManagedPath(gitCommonDir: string, worktreePath: string): void {
  const paths = getManagedPaths(gitCommonDir)
  paths.add(worktreePath)
  writeFileSync(registryPath(gitCommonDir), JSON.stringify([...paths], null, 2), 'utf-8')
}

export function removeManagedPath(gitCommonDir: string, worktreePath: string): void {
  const paths = getManagedPaths(gitCommonDir)
  paths.delete(worktreePath)
  writeFileSync(registryPath(gitCommonDir), JSON.stringify([...paths], null, 2), 'utf-8')
}
