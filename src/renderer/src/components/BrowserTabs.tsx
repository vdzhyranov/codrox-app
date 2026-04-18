import { useState, useCallback, useEffect } from 'react'
import { BrowserPanel } from './BrowserPanel'

export interface BrowserTabData {
  id: string
  url: string
  title: string
}

let _tabCounter = 0
function makeTabId(): string {
  return `btab-${Date.now()}-${++_tabCounter}`
}

interface BrowserTabsProps {
  /** Called to switch back to the panel view */
  onSwitchToPanel: () => void
}

export function BrowserTabs({ onSwitchToPanel }: BrowserTabsProps): JSX.Element {
  const [tabs, setTabs] = useState<BrowserTabData[]>([
    { id: makeTabId(), url: 'https://www.google.com', title: 'New Tab' },
  ])
  const [activeTabId, setActiveTabId] = useState(tabs[0].id)

  const addTab = useCallback((url = 'https://www.google.com') => {
    const id = makeTabId()
    setTabs((prev) => [...prev, { id, url, title: 'New Tab' }])
    setActiveTabId(id)
  }, [])

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId)
      if (next.length === 0) {
        // No tabs left — switch back to panel view
        onSwitchToPanel()
        return prev
      }
      return next
    })
    setActiveTabId((prev) => {
      if (prev !== tabId) return prev
      // Activate adjacent tab
      const idx = tabs.findIndex((t) => t.id === tabId)
      const fallback = tabs[idx + 1] ?? tabs[idx - 1]
      return fallback?.id ?? tabs[0]?.id ?? ''
    })
  }, [tabs, onSwitchToPanel])

  // Listen for link-click events to open URLs in a new browser tab here
  useEffect(() => {
    const handler = (e: Event): void => {
      const url = (e as CustomEvent).detail?.url
      if (url) addTab(url)
    }
    window.addEventListener('open-in-browser', handler)

    const unsubIpc = window.api.on('browser:open-url', (payload: unknown) => {
      const { url } = payload as { url: string }
      if (url) addTab(url)
    })

    return () => {
      window.removeEventListener('open-in-browser', handler)
      unsubIpc()
    }
  }, [addTab])

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Tab bar */}
      <div
        style={{
          height: 32,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'stretch',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {/* Mode switch: back to panel */}
        <button
          onClick={onSwitchToPanel}
          title="Switch to Panel"
          style={{
            width: 28,
            flexShrink: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--text3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            borderRight: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>

        {/* Browser tabs */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 8px',
                  cursor: 'pointer',
                  maxWidth: 140,
                  minWidth: 0,
                  borderBottom: isActive ? '2px solid #60a5fa' : '2px solid transparent',
                  background: isActive ? 'var(--surface2)' : 'transparent',
                  transition: 'background .1s',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--mono)',
                    fontWeight: 500,
                    color: isActive ? 'var(--text)' : 'var(--text3)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {tab.title}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text3)',
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: '0 1px',
                    lineHeight: 1,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>

        {/* New tab button */}
        <button
          onClick={() => addTab()}
          title="New tab"
          style={{
            width: 28,
            flexShrink: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--text3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
        >
          +
        </button>
      </div>

      {/* Active browser content */}
      {activeTab && (
        <BrowserPanel
          key={activeTab.id}
          initialUrl={activeTab.url}
          onTitleChange={(title) => {
            setTabs((prev) => prev.map((t) => t.id === activeTab.id ? { ...t, title } : t))
          }}
        />
      )}
    </div>
  )
}
