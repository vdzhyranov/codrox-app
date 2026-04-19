import { useRef, useState, useCallback, useEffect } from 'react'

interface BrowserPanelProps {
  initialUrl?: string
  onTitleChange?: (title: string) => void
}

export function BrowserPanel({ initialUrl = 'https://www.google.com', onTitleChange }: BrowserPanelProps): JSX.Element {
  const webviewRef = useRef<Electron.WebviewTag>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(initialUrl)
  const [inputValue, setInputValue] = useState(initialUrl)
  const [isLoading, setIsLoading] = useState(true)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [pageTitle, setPageTitle] = useState('')
  const [devToolsOpen, setDevToolsOpen] = useState(false)
  const [devToolsKey, setDevToolsKey] = useState(0)
  const [devToolsHeight, setDevToolsHeight] = useState(250)
  const [isResizing, setIsResizing] = useState(false)
  const mainWvReady = useRef(false)

  // ── Webview event listeners ────────────────────────────────────────────

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const onReady = (): void => { mainWvReady.current = true }
    const onStartLoad = (): void => setIsLoading(true)
    const onStopLoad = (): void => {
      setIsLoading(false)
      setCanGoBack(wv.canGoBack())
      setCanGoForward(wv.canGoForward())
    }
    const onNavigate = (e: Electron.DidNavigateEvent): void => {
      setUrl(e.url)
      setInputValue(e.url)
      setCanGoBack(wv.canGoBack())
      setCanGoForward(wv.canGoForward())
    }
    const onTitleUpdate = (e: Electron.PageTitleUpdatedEvent): void => {
      setPageTitle(e.title)
      onTitleChange?.(e.title)
    }
    const onNewWindow = (e: Event): void => {
      const detail = (e as CustomEvent).detail || e
      const targetUrl = (detail as { url?: string }).url
      if (targetUrl) {
        window.dispatchEvent(new CustomEvent('open-in-browser', { detail: { url: targetUrl } }))
      }
    }

    wv.addEventListener('dom-ready', onReady)
    wv.addEventListener('did-start-loading', onStartLoad)
    wv.addEventListener('did-stop-loading', onStopLoad)
    wv.addEventListener('did-navigate', onNavigate)
    wv.addEventListener('did-navigate-in-page', onNavigate as EventListener)
    wv.addEventListener('page-title-updated', onTitleUpdate)
    wv.addEventListener('new-window', onNewWindow)

    return () => {
      wv.removeEventListener('dom-ready', onReady)
      wv.removeEventListener('did-start-loading', onStartLoad)
      wv.removeEventListener('did-stop-loading', onStopLoad)
      wv.removeEventListener('did-navigate', onNavigate)
      wv.removeEventListener('did-navigate-in-page', onNavigate as EventListener)
      wv.removeEventListener('page-title-updated', onTitleUpdate)
      wv.removeEventListener('new-window', onNewWindow)
    }
  }, [])

  // ── Toggle DevTools ────────────────────────────────────────────────────

  const toggleDevTools = useCallback(async () => {
    const wv = webviewRef.current
    if (!wv || !mainWvReady.current) return

    let targetId: number
    try {
      targetId = (wv as unknown as { getWebContentsId(): number }).getWebContentsId()
    } catch {
      return
    }

    if (devToolsOpen) {
      // Close: IPC first, then unmount
      await window.api.invoke('browser:close-devtools', { targetId })
      setDevToolsOpen(false)
    } else {
      // Open: tell main to wire the NEXT webview as devtools, then mount it
      await window.api.invoke('browser:prepare-devtools', { targetId })
      setDevToolsKey((k) => k + 1) // fresh webview = fresh WebContents
      setDevToolsOpen(true)
    }
  }, [devToolsOpen])

  // ── Navigation ─────────────────────────────────────────────────────────

  const navigate = useCallback((targetUrl: string) => {
    const wv = webviewRef.current
    if (!wv) return
    let finalUrl = targetUrl.trim()
    if (!finalUrl) return
    if (!/^https?:\/\//i.test(finalUrl)) {
      if (/^[^\s]+\.[^\s]+/.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl
      } else {
        finalUrl = 'https://www.google.com/search?q=' + encodeURIComponent(finalUrl)
      }
    }
    setUrl(finalUrl)
    setInputValue(finalUrl)
    wv.loadURL(finalUrl)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      navigate(inputValue)
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setInputValue(url)
      inputRef.current?.blur()
    }
  }, [inputValue, url, navigate])

  const goBack = useCallback(() => webviewRef.current?.goBack(), [])
  const goForward = useCallback(() => webviewRef.current?.goForward(), [])
  const reload = useCallback(() => webviewRef.current?.reload(), [])

  // ── F12 / Cmd+Shift+I ─────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'F12' || (e.metaKey && e.shiftKey && e.key === 'i')) {
        e.preventDefault()
        toggleDevTools()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleDevTools])

  // ── Resize handle ──────────────────────────────────────────────────────

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      const startY = e.clientY
      const startH = devToolsHeight

      const onMove = (ev: MouseEvent): void => {
        setDevToolsHeight(Math.max(80, Math.min(600, startH + (startY - ev.clientY))))
      }
      const onUp = (): void => {
        setIsResizing(false)
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [devToolsHeight]
  )

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)', position: 'relative' }}>
      {/* Navigation bar */}
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 6px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <NavButton onClick={goBack} disabled={!canGoBack} title="Back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </NavButton>

        <NavButton onClick={goForward} disabled={!canGoForward} title="Forward">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </NavButton>

        <NavButton onClick={reload} title={isLoading ? 'Stop' : 'Reload'}>
          {isLoading ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          )}
        </NavButton>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.target.select()}
          placeholder="Search or enter URL"
          style={{
            flex: 1,
            height: 26,
            padding: '0 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
            color: 'var(--text)',
            fontSize: 12,
            fontFamily: 'var(--mono)',
            outline: 'none',
            minWidth: 0,
          }}
        />

        <NavButton onClick={toggleDevTools} title="Toggle DevTools (F12)">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={devToolsOpen ? '#60a5fa' : 'currentColor'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </NavButton>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div style={{
          height: 2,
          flexShrink: 0,
          background: 'var(--accent)',
          animation: 'browser-loading 1.5s ease-in-out infinite',
        }}>
          <style>{`
            @keyframes browser-loading {
              0% { width: 0%; opacity: 1; }
              50% { width: 70%; opacity: 1; }
              100% { width: 100%; opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* Main content: webview + inline Chrome DevTools */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        {/* Page webview */}
        <webview
          ref={webviewRef}
          src={initialUrl}
          style={{ flex: 1, border: 'none', minHeight: 0 }}
          // @ts-expect-error Electron webview attributes not in React types
          allowpopups="true"
        />

        {/* Resize overlay — prevents webview stealing mouse during drag */}
        {isResizing && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'row-resize' }} />
        )}

        {/* Inline DevTools */}
        {devToolsOpen && (
          <>
            <div
              onMouseDown={onResizeStart}
              style={{
                height: 4,
                flexShrink: 0,
                cursor: 'row-resize',
                background: isResizing ? 'var(--accent)' : 'var(--border)',
                transition: isResizing ? 'none' : 'background .15s',
              }}
              onMouseEnter={(e) => { if (!isResizing) e.currentTarget.style.background = 'var(--accent)' }}
              onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = 'var(--border)' }}
            />
            <webview
              key={devToolsKey}
              src="about:blank"
              style={{ height: devToolsHeight, flexShrink: 0, border: 'none' }}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ── NavButton ────────────────────────────────────────────────────────────────

function NavButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 26,
        height: 26,
        borderRadius: 4,
        border: 'none',
        background: 'transparent',
        color: disabled ? 'var(--text3)' : 'var(--text2)',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
        transition: 'background .1s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = 'var(--surface2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}
