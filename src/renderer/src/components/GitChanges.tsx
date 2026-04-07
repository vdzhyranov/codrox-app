import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useEffect, useState, useRef } from 'react'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import type { GitFileStatus } from '@shared/types/git'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  modified:  { label: 'M', color: 'var(--amber)', bg: 'var(--amber-dim)', border: 'rgba(245,158,11,.25)' },
  added:     { label: 'A', color: 'var(--green)',  bg: 'var(--green-dim)', border: 'rgba(62,207,142,.25)' },
  deleted:   { label: 'D', color: 'var(--red)',    bg: 'var(--red-dim)',   border: 'rgba(248,113,113,.25)' },
  renamed:   { label: 'R', color: 'var(--blue)',   bg: 'var(--blue-dim)', border: 'rgba(96,165,250,.25)' },
  untracked: { label: '?', color: 'var(--text3)',  bg: 'var(--surface3)', border: 'var(--border)' },
}

type ActionState = 'idle' | 'loading' | 'success' | 'error'

interface CommitDialogProps {
  changes: GitFileStatus[]
  onCommit: (message: string) => Promise<void>
  onCancel: () => void
}

function CommitDialog({ changes, onCommit, onCancel }: CommitDialogProps): JSX.Element {
  const [message, setMessage] = useState('')
  const [state, setState] = useState<ActionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleCommit = async (): Promise<void> => {
    if (!message.trim()) return
    setState('loading')
    setError(null)
    try {
      await onCommit(message.trim())
      setState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed')
      setState('error')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleCommit()
    }
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--accent)',
          borderRadius: 10,
          padding: '20px',
          width: 360,
          maxWidth: '90vw',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,106,247,0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Dialog header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', letterSpacing: '0.05em' }}>
            Commit Changes
          </span>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text3)',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              padding: '2px 4px',
              borderRadius: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Files to be committed */}
        <div
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '8px 10px',
            maxHeight: 120,
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>
            {changes.length} file{changes.length !== 1 ? 's' : ''} to commit
          </div>
          {changes.map((f) => {
            const cfg = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.modified
            return (
              <div
                key={f.path}
                style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, flexShrink: 0 }}>
                  {cfg.label}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.path}
                </span>
              </div>
            )
          })}
        </div>

        {/* Commit message input */}
        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Commit message (⌘↵ to commit)"
          rows={3}
          style={{
            width: '100%',
            resize: 'vertical',
            padding: '8px 10px',
            fontSize: 11,
            lineHeight: 1.5,
          }}
        />

        {error && (
          <div style={{ fontSize: 10, color: 'var(--red)', background: 'var(--red-dim)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 5, padding: '6px 10px' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 11,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text2)',
              fontFamily: 'var(--mono)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCommit}
            disabled={!message.trim() || state === 'loading'}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: 11,
              cursor: message.trim() && state !== 'loading' ? 'pointer' : 'not-allowed',
              border: '1px solid rgba(124,106,247,.4)',
              background: message.trim() ? 'var(--accent-dim)' : 'transparent',
              color: message.trim() ? 'var(--accent2)' : 'var(--text3)',
              fontFamily: 'var(--mono)',
              fontWeight: 600,
              transition: 'all .12s',
              opacity: state === 'loading' ? 0.6 : 1,
            }}
          >
            {state === 'loading' ? 'Committing…' : state === 'success' ? 'Done' : 'Commit'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function GitChanges(): JSX.Element {
  const activeWorktreePath = useActiveWorktreePath()
  const openFile = useFileTreeStore((s) => s.openFile)
  const [changes, setChanges] = useState<GitFileStatus[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [actionState, setActionState] = useState<Record<string, ActionState>>({})
  const [notification, setNotification] = useState<{ msg: string; ok: boolean } | null>(null)

  const refreshChanges = (): void => {
    if (!activeWorktreePath) return
    window.api
      .invoke('git:status', { worktreePath: activeWorktreePath })
      .then((result) => setChanges(result as GitFileStatus[]))
      .catch(() => setChanges([]))
  }

  useEffect(() => {
    refreshChanges()
  }, [activeWorktreePath])

  const showNotif = (msg: string, ok: boolean): void => {
    setNotification({ msg, ok })
    setTimeout(() => setNotification(null), 3000)
  }

  const setAction = (key: string, state: ActionState): void => {
    setActionState((prev) => ({ ...prev, [key]: state }))
  }

  const handleRevertFile = async (): Promise<void> => {
    if (!activeWorktreePath || !selectedPath) return
    setAction('revertFile', 'loading')
    try {
      await window.api.invoke('git:revertFile', { worktreePath: activeWorktreePath, filePath: selectedPath })
      setAction('revertFile', 'idle')
      setSelectedPath(null)
      refreshChanges()
      showNotif(`Reverted ${selectedPath.split('/').pop()}`, true)
    } catch (err) {
      setAction('revertFile', 'idle')
      showNotif(err instanceof Error ? err.message : 'Revert failed', false)
    }
  }

  const handleRevertAll = async (): Promise<void> => {
    if (!activeWorktreePath) return
    setAction('revertAll', 'loading')
    try {
      await window.api.invoke('git:revertAll', { worktreePath: activeWorktreePath })
      setAction('revertAll', 'idle')
      setSelectedPath(null)
      refreshChanges()
      showNotif('All changes reverted', true)
    } catch (err) {
      setAction('revertAll', 'idle')
      showNotif(err instanceof Error ? err.message : 'Revert failed', false)
    }
  }

  const handleCommit = async (message: string): Promise<void> => {
    if (!activeWorktreePath) return
    await window.api.invoke('git:commit', { worktreePath: activeWorktreePath, message })
    setShowCommitDialog(false)
    setSelectedPath(null)
    refreshChanges()
    showNotif('Committed successfully', true)
  }

  const handlePush = async (): Promise<void> => {
    if (!activeWorktreePath) return
    setAction('push', 'loading')
    try {
      await window.api.invoke('git:push', { worktreePath: activeWorktreePath })
      setAction('push', 'idle')
      showNotif('Pushed successfully', true)
    } catch (err) {
      setAction('push', 'idle')
      showNotif(err instanceof Error ? err.message : 'Push failed', false)
    }
  }

  const handlePull = async (): Promise<void> => {
    if (!activeWorktreePath) return
    setAction('pull', 'loading')
    try {
      await window.api.invoke('git:pull', { worktreePath: activeWorktreePath })
      setAction('pull', 'idle')
      refreshChanges()
      showNotif('Pulled successfully', true)
    } catch (err) {
      setAction('pull', 'idle')
      showNotif(err instanceof Error ? err.message : 'Pull failed', false)
    }
  }

  const handleFileClick = (file: GitFileStatus): void => {
    if (!activeWorktreePath) return
    setSelectedPath(file.path)
    const fullPath = `${activeWorktreePath}/${file.path}`
    openFile(fullPath)
  }

  const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 5,
    fontSize: 10,
    fontFamily: 'var(--mono)',
    cursor: 'pointer',
    transition: 'all .12s',
    border: '1px solid transparent',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
      {/* Section header — collapsible */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          padding: '8px 12px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 9, color: 'var(--text3)', transition: 'transform .15s', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
          ▾
        </span>
        <span
          style={{
            flex: 1,
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

      {/* Collapsible body */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: collapsed ? 0 : 400,
          transition: 'max-height .2s ease',
        }}
      >
        {/* Git action toolbar */}
        <div
          style={{
            padding: '6px 12px 4px',
            display: 'flex',
            gap: 5,
            flexWrap: 'wrap',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Revert File */}
          <button
            onClick={handleRevertFile}
            disabled={!selectedPath || actionState.revertFile === 'loading'}
            title={selectedPath ? `Revert ${selectedPath}` : 'Select a file to revert'}
            style={{
              ...btnBase,
              background: selectedPath ? 'var(--red-dim)' : 'transparent',
              color: selectedPath ? 'var(--red)' : 'var(--text3)',
              border: `1px solid ${selectedPath ? 'rgba(248,113,113,.25)' : 'var(--border)'}`,
              opacity: selectedPath ? 1 : 0.5,
              cursor: selectedPath ? 'pointer' : 'not-allowed',
            }}
          >
            <span>↺</span>
            <span>Revert</span>
          </button>

          {/* Revert All */}
          <button
            onClick={handleRevertAll}
            disabled={changes.length === 0 || actionState.revertAll === 'loading'}
            title="Revert all changes"
            style={{
              ...btnBase,
              background: changes.length > 0 ? 'var(--red-dim)' : 'transparent',
              color: changes.length > 0 ? 'var(--red)' : 'var(--text3)',
              border: `1px solid ${changes.length > 0 ? 'rgba(248,113,113,.25)' : 'var(--border)'}`,
              opacity: changes.length > 0 ? 1 : 0.5,
              cursor: changes.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            {actionState.revertAll === 'loading' ? '…' : '↺↺'}
          </button>

          {/* Commit */}
          <button
            onClick={() => setShowCommitDialog(true)}
            disabled={changes.length === 0}
            title="Commit changes"
            style={{
              ...btnBase,
              background: changes.length > 0 ? 'var(--accent-dim)' : 'transparent',
              color: changes.length > 0 ? 'var(--accent2)' : 'var(--text3)',
              border: `1px solid ${changes.length > 0 ? 'rgba(124,106,247,.35)' : 'var(--border)'}`,
              opacity: changes.length > 0 ? 1 : 0.5,
              cursor: changes.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            <span>◎</span>
            <span>Commit</span>
          </button>

          {/* Push */}
          <button
            onClick={handlePush}
            disabled={actionState.push === 'loading'}
            title="Push current branch"
            style={{
              ...btnBase,
              background: 'var(--green-dim)',
              color: 'var(--green)',
              border: '1px solid rgba(62,207,142,.25)',
            }}
          >
            {actionState.push === 'loading' ? '…' : '↑'}
          </button>

          {/* Pull */}
          <button
            onClick={handlePull}
            disabled={actionState.pull === 'loading'}
            title="Pull current branch"
            style={{
              ...btnBase,
              background: 'var(--green-dim)',
              color: 'var(--green)',
              border: '1px solid rgba(62,207,142,.25)',
            }}
          >
            {actionState.pull === 'loading' ? '…' : '↓'}
          </button>
        </div>

        {/* Notification */}
        {notification && (
          <div
            style={{
              margin: '6px 12px 0',
              padding: '5px 10px',
              borderRadius: 5,
              fontSize: 10,
              background: notification.ok ? 'var(--green-dim)' : 'var(--red-dim)',
              color: notification.ok ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${notification.ok ? 'rgba(62,207,142,.25)' : 'rgba(248,113,113,.25)'}`,
              transition: 'opacity .2s',
            }}
          >
            {notification.msg}
          </div>
        )}

        {/* File list */}
        <div style={{ maxHeight: 180, overflowY: 'auto', padding: '6px 12px 10px' }}>
          {changes.length === 0 ? (
            <p style={{ fontSize: 10, color: 'var(--text3)' }}>No changes</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {changes.map((file) => {
                const cfg = STATUS_CONFIG[file.status] ?? STATUS_CONFIG.modified
                const isSelected = file.path === selectedPath
                return (
                  <div
                    key={file.path}
                    onClick={() => handleFileClick(file)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '3px 6px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      transition: 'all .1s',
                      background: isSelected ? 'var(--surface3)' : 'transparent',
                      border: isSelected ? '1px solid var(--border2)' : '1px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--surface2)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent'
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
                        color: isSelected ? 'var(--text)' : 'var(--text2)',
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
      </div>

      {/* Commit dialog */}
      {showCommitDialog && (
        <CommitDialog
          changes={changes}
          onCommit={handleCommit}
          onCancel={() => setShowCommitDialog(false)}
        />
      )}
    </div>
  )
}
