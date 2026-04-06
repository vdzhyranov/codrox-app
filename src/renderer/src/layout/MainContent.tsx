import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
// tabStore unused after tmux migration — keep import if lifecycle phases need it
// import { useTabStore } from '@renderer/store/tabStore'
import { DirectoryPicker } from '@renderer/components/DirectoryPicker'
import { WorkspaceView } from '@renderer/components/WorkspaceView'
import { TmuxInstallCheck } from '@renderer/components/TmuxInstallCheck'
import {
  ModePicker,
  ProposePhase,
  GrillPhase,
  ResearchPhase,
  PlanPhase,
  ImplementPhase,
  VerifyPhase,
  PhaseFooter,
} from '@renderer/components/LifecyclePhases'
import type { LifecyclePhase } from '@shared/types'

// ── Phase Track (interactive) ──────────────────────────────────────────────

const PHASES: { id: LifecyclePhase; label: string; icon: string; color: string }[] = [
  { id: 'propose', label: 'Propose', icon: '◈', color: '#a78bfa' },
  { id: 'grill', label: 'Grill', icon: '⚡', color: '#f87171' },
  { id: 'research', label: 'Research', icon: '⊡', color: '#60a5fa' },
  { id: 'plan', label: 'Plan', icon: '≡', color: '#f59e0b' },
  { id: 'implement', label: 'Implement', icon: '⟩', color: '#3ecf8e' },
  { id: 'verify', label: 'Verify', icon: '✓', color: '#3ecf8e' },
]

function InteractivePhaseTrack({
  currentPhase,
  worktreePath,
}: {
  currentPhase: LifecyclePhase
  worktreePath: string
}): JSX.Element {
  const setLifecyclePhase = useWorkspaceStore((s) => s.setLifecyclePhase)
  const currentIdx = PHASES.findIndex((p) => p.id === currentPhase)

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          padding: '0 20px',
          height: 52,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {PHASES.map((phase, i) => {
          const isActive = phase.id === currentPhase
          const isDone = i < currentIdx

          return (
            <div
              key={phase.id}
              style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
              {i > 0 && (
                <div style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ height: 1, width: '100%', background: isDone ? phase.color : 'var(--border2)', opacity: isDone ? 0.5 : 1 }} />
                </div>
              )}
              <div
                onClick={() => setLifecyclePhase(worktreePath, phase.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 14px',
                  height: 52,
                  gap: 3,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all .15s',
                }}
              >
                <span style={{
                  fontSize: 14,
                  lineHeight: 1,
                  color: isActive ? phase.color : isDone ? 'var(--green)' : 'var(--text3)',
                }}>
                  {isDone ? '✓' : phase.icon}
                </span>
                <span style={{
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  color: isActive ? 'var(--text)' : isDone ? 'var(--green)' : 'var(--text3)',
                }}>
                  {phase.label}
                </span>
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '20%',
                    right: '20%',
                    height: 2,
                    borderRadius: '2px 2px 0 0',
                    background: phase.color,
                  }} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── Lifecycle Phase Content ────────────────────────────────────────────────

function LifecycleContent({
  worktreePath,
  phase,
}: {
  worktreePath: string
  phase: LifecyclePhase
}): JSX.Element {
  const lifecycleByWorktree = useWorkspaceStore((s) => s.lifecycleByWorktree)
  const lifecycle = lifecycleByWorktree[worktreePath] ?? { phase: null }

  switch (phase) {
    case 'propose':
      return <ProposePhase worktreePath={worktreePath} lifecycle={lifecycle} />
    case 'grill':
      return <GrillPhase worktreePath={worktreePath} />
    case 'research':
      return <ResearchPhase worktreePath={worktreePath} />
    case 'plan':
      return <PlanPhase worktreePath={worktreePath} lifecycle={lifecycle} />
    case 'implement':
      return <ImplementPhase worktreePath={worktreePath} lifecycle={lifecycle} />
    case 'verify':
      return <VerifyPhase worktreePath={worktreePath} lifecycle={lifecycle} />
    default:
      return <div />
  }
}

// ── Main Export ─────────────────────────────────────────────────────────────

export function MainContent(): JSX.Element {
  const activeWorktreePath = useActiveWorktreePath()
  const modeByWorktree = useWorkspaceStore((s) => s.modeByWorktree)
  const lifecycleByWorktree = useWorkspaceStore((s) => s.lifecycleByWorktree)

  // No workspace selected — welcome screen
  if (!activeWorktreePath) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ color: 'var(--accent)', fontSize: 28 }}>◈</span>
            <h1 style={{ fontFamily: 'var(--sans)', fontSize: 28, fontWeight: 800, letterSpacing: '0.04em', color: 'var(--text)' }}>
              COD<em style={{ color: 'var(--accent2)', fontStyle: 'normal' }}>ROX</em>
            </h1>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            AI-Native Development Environment
          </p>
        </div>
        <DirectoryPicker />
      </div>
    )
  }

  const mode = modeByWorktree[activeWorktreePath] ?? 'terminal'  // default to terminal (tmux)
  const lifecycle = lifecycleByWorktree[activeWorktreePath]
  const currentPhase = lifecycle?.phase ?? null

  // Lifecycle mode — show phase track + phase content
  if (mode === 'lifecycle' && currentPhase) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
        <InteractivePhaseTrack currentPhase={currentPhase} worktreePath={activeWorktreePath} />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <LifecycleContent worktreePath={activeWorktreePath} phase={currentPhase} />
        </div>
        <PhaseFooter worktreePath={activeWorktreePath} currentPhase={currentPhase} />
      </div>
    )
  }

  // Terminal or Claude mode — show workspace view
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <TmuxInstallCheck>
        <WorkspaceView worktreePath={activeWorktreePath} />
      </TmuxInstallCheck>
    </div>
  )
}
