import { useState } from 'react'
import { useLinearStore } from '@renderer/store/linearStore'

export function CreateTaskModal({ onClose }: { onClose: () => void }): JSX.Element {
  const teams = useLinearStore((s) => s.teams)
  const createTask = useLinearStore((s) => s.createTask)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '')
  const [priority, setPriority] = useState(0)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (): Promise<void> => {
    if (!title.trim() || !teamId) return
    setCreating(true)
    setError(null)
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        teamId,
        priority: priority || undefined
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && e.metaKey) handleSubmit()
  }

  const priorities = [
    { value: 0, label: 'None' },
    { value: 1, label: 'Urgent' },
    { value: 2, label: 'High' },
    { value: 3, label: 'Medium' },
    { value: 4, label: 'Low' },
  ]

  return (
    <div
      onClick={onClose}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 20,
          width: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          New Linear Issue
        </span>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Issue title"
          autoFocus
          style={{
            padding: '6px 10px',
            fontSize: 12,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            color: 'var(--text)',
            fontFamily: 'var(--mono)',
            outline: 'none',
          }}
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={3}
          style={{
            padding: '6px 10px',
            fontSize: 11,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            color: 'var(--text)',
            fontFamily: 'var(--mono)',
            outline: 'none',
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.06em' }}>
              TEAM
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                color: 'var(--text)',
                fontFamily: 'var(--mono)',
              }}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.key} - {t.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.06em' }}>
              PRIORITY
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                color: 'var(--text)',
                fontFamily: 'var(--mono)',
              }}
            >
              {priorities.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <span style={{ fontSize: 10, color: 'var(--red)' }}>{error}</span>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text3)',
              fontSize: 11,
              padding: '4px 12px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating || !title.trim() || !teamId}
            style={{
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 5,
              color: '#fff',
              fontSize: 11,
              padding: '4px 12px',
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: creating || !title.trim() || !teamId ? 0.6 : 1,
            }}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
