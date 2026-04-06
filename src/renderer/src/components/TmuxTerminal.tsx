import { useRef } from 'react'
import { TmuxToolbar } from './TmuxToolbar'
import { useTmuxPTY } from '@renderer/hooks/useTmuxPTY'

interface TmuxTerminalProps {
  worktreePath: string
  sessionName: string
}

export function TmuxTerminal({ worktreePath, sessionName }: TmuxTerminalProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  useTmuxPTY({ sessionName, worktreePath, containerRef })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TmuxToolbar sessionName={sessionName} worktreePath={worktreePath} />
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }} />
    </div>
  )
}
