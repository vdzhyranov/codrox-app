import { useState } from 'react'
import { useLinearStore } from '@renderer/store/linearStore'

export function LinearSetupModal({ onClose }: { onClose: () => void }): JSX.Element {
  const setup = useLinearStore((s) => s.setup)

  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (): Promise<void> => {
    const key = apiKey.trim()
    if (!key) return
    setSaving(true)
    setError(null)
    try {
      await setup(key)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid API key')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && apiKey.trim()) handleSubmit()
  }

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
          Connect Linear
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.06em' }}>
            API KEY
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="lin_api_..."
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
          <span style={{ fontSize: 9, color: 'var(--text3)', lineHeight: 1.4 }}>
            Linear Settings &gt; Account &gt; API &gt; Personal API keys
          </span>
        </div>

        <span style={{ fontSize: 9, color: 'var(--text3)', lineHeight: 1.4, opacity: 0.7 }}>
          The key will be saved as an environment variable in your shell profile.
        </span>

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
            disabled={saving || !apiKey.trim()}
            style={{
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 5,
              color: '#fff',
              fontSize: 11,
              padding: '4px 12px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving || !apiKey.trim() ? 0.6 : 1,
            }}
          >
            {saving ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}
