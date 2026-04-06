import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useEffect, useState } from 'react'
import { useTabStore } from '@renderer/store/tabStore'
import type { GitFileStatus } from '@shared/types/git'
import type { EditorTab } from '@shared/types/tabs'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  modified: { label: 'M', color: 'var(--amber)', bg: 'var(--amber-dim)', border: 'rgba(245,158,11,.25)' },
  added:    { label: 'A', color: 'var(--green)',  bg: 'var(--green-dim)', border: 'rgba(62,207,142,.25)' },
  deleted:  { label: 'D', color: 'var(--red)',    bg: 'var(--red-dim)',   border: 'rgba(248,113,113,.25)' },
  renamed:  { label: 'R', color: 'var(--blue)',   bg: 'var(--blue-dim)', border: 'rgba(96,165,250,.25)' },
  untracked:{ label: '?', color: 'var(--text3)',  bg: 'var(--surface3)', border: 'var(--border)' },
}

export function GitChanges(): JSX.Element {
  const activeWorktreePath = useActiveWorktreePath()
  const openTab = useTabStore((s) => s.openTab)
  const [changes, setChanges] = useState<GitFileStatus[]>([])

  useEffect(() => {
    if (!activeWorktreePath) return
    window.api
      .invoke('git:status', { worktreePath: activeWorktreePath })
      .then((result) => setChanges(result as GitFileStatus[]))
      .catch(() => setChanges([]))
  }, [activeWorktreePath])

  const handleClick = (file: GitFileStatus): void => {
    if (!activeWorktreePath) return
    const fullPath = `${activeWorktreePath}/${file.path}`
    const tab: EditorTab = {
      id: `editor-${fullPath}`,
      type: 'editor',
      title: file.path.split('/').pop() || file.path,
      worktreeId: activeWorktreePath,
      filePath: fullPath,
      isDirty: false
    }
    openTab(activeWorktreePath, tab)
  }

  return (
    <div style={{ maxHeight: 200, overflowY: 'auto', padding: '10px 12px' }}>
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: changes.length > 0 ? 6 : 4,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'var(--text3)',
            textTransform: 'uppercase',
          }}
        >
          Changes
        </span>
        {changes.length > 0 && (
          <span
            style={{
              fontSize: 9,
              padding: '1px 6px',
              borderRadius: 3,
              background: 'var(--surface3)',
              color: 'var(--text3)',
              border: '1px solid var(--border)',
              fontWeight: 600,
            }}
          >
            {changes.length}
          </span>
        )}
      </div>

      {changes.length === 0 ? (
        <p style={{ fontSize: 10, color: 'var(--text3)' }}>No changes</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {changes.map((file) => {
            const cfg = STATUS_CONFIG[file.status] ?? STATUS_CONFIG.modified
            return (
              <div
                key={file.path}
                onClick={() => handleClick(file)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '3px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all .1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* Status badge */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    fontSize: 9,
                    fontWeight: 700,
                    flexShrink: 0,
                    background: cfg.bg,
                    color: cfg.color,
                    border: `1px solid ${cfg.border}`,
                  }}
                >
                  {cfg.label}
                </span>
                {/* File path */}
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {file.path}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
