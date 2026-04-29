import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { addManagedPath, getManagedPaths, removeManagedPath } from './WorktreeRegistry'

describe('WorktreeRegistry', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'worktree-registry-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns empty set when no registry file exists', () => {
    expect(getManagedPaths(tmpDir).size).toBe(0)
  })

  it('persists added paths', () => {
    addManagedPath(tmpDir, '/repo/project-branch-a')
    addManagedPath(tmpDir, '/repo/project-branch-b')

    const paths = getManagedPaths(tmpDir)
    expect(paths.has('/repo/project-branch-a')).toBe(true)
    expect(paths.has('/repo/project-branch-b')).toBe(true)
    expect(paths.size).toBe(2)
  })

  it('does not duplicate paths on repeated add', () => {
    addManagedPath(tmpDir, '/repo/project-branch-a')
    addManagedPath(tmpDir, '/repo/project-branch-a')

    expect(getManagedPaths(tmpDir).size).toBe(1)
  })

  it('removes a path from the registry', () => {
    addManagedPath(tmpDir, '/repo/project-branch-a')
    addManagedPath(tmpDir, '/repo/project-branch-b')
    removeManagedPath(tmpDir, '/repo/project-branch-a')

    const paths = getManagedPaths(tmpDir)
    expect(paths.has('/repo/project-branch-a')).toBe(false)
    expect(paths.has('/repo/project-branch-b')).toBe(true)
  })

  it('is a no-op when removing a path that was never added', () => {
    addManagedPath(tmpDir, '/repo/project-branch-a')
    removeManagedPath(tmpDir, '/repo/nonexistent')

    expect(getManagedPaths(tmpDir).size).toBe(1)
  })
})
