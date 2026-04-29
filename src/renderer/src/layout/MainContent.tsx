import { useRef } from 'react'
import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { DirectoryPicker } from '@renderer/components/DirectoryPicker'
import logoImg from '@renderer/assets/logo.png'
import { WorkspaceView } from '@renderer/components/WorkspaceView'

export function MainContent(): JSX.Element {
  const activeWorktreePath = useActiveWorktreePath()

  // Track all worktrees that have been visited so we can keep them mounted
  const visitedRef = useRef<Set<string>>(new Set())
  if (activeWorktreePath) {
    visitedRef.current.add(activeWorktreePath)
  }
  const visited = Array.from(visitedRef.current)

  if (!activeWorktreePath) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <img src={logoImg} alt="Codrox" style={{ height: 40 }} draggable={false} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            AI-Native Development Environment
          </p>
        </div>
        <DirectoryPicker />
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
      {visited.map((wtPath) => {
        const isActive = wtPath === activeWorktreePath
        return (
          <div key={wtPath} style={{ display: isActive ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <WorkspaceView worktreePath={wtPath} />
          </div>
        )
      })}
    </div>
  )
}
