import { useEffect, useState } from 'react'

function TmuxInstallPrompt(): JSX.Element {
  const isLinux = navigator.userAgent.toLowerCase().includes('linux')

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          padding: 32,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠</span>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 13,
              color: 'var(--text)',
              fontWeight: 600,
            }}
          >
            tmux not found
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--text2)',
            lineHeight: 1.6,
          }}
        >
          tmux is required for Codrox terminal features. Please install it and restart the app.
        </p>

        {/* Install command */}
        <div
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '8px 12px',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: 'var(--green)',
          }}
        >
          {isLinux ? '$ sudo apt install tmux' : '$ brew install tmux'}
        </div>

        {/* Secondary hint for Linux users */}
        {isLinux && (
          <p
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--text3)',
            }}
          >
            Or use your distro&apos;s package manager: pacman -S tmux / dnf install tmux
          </p>
        )}

        {/* Check again button */}
        <button
          onClick={() => { window.location.reload() }}
          style={{
            alignSelf: 'flex-start',
            padding: '5px 14px',
            height: 28,
            borderRadius: 4,
            border: '1px solid var(--border2)',
            background: 'var(--surface2)',
            color: 'var(--text2)',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            cursor: 'pointer',
            transition: 'color .1s, border-color .1s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text)'
            e.currentTarget.style.borderColor = 'var(--accent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text2)'
            e.currentTarget.style.borderColor = 'var(--border2)'
          }}
        >
          Check Again
        </button>
      </div>
    </div>
  )
}

interface TmuxInstallCheckProps {
  children: JSX.Element
}

export function TmuxInstallCheck({ children }: TmuxInstallCheckProps): JSX.Element {
  const [installed, setInstalled] = useState<boolean | null>(null)

  useEffect(() => {
    window.api.invoke('tmux:isInstalled', undefined).then((result) => {
      setInstalled(result as boolean)
    }).catch(() => {
      setInstalled(false)
    })
  }, [])

  if (installed === null) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--text3)',
        }}
      >
        Checking tmux...
      </div>
    )
  }

  if (!installed) {
    return <TmuxInstallPrompt />
  }

  return children
}
