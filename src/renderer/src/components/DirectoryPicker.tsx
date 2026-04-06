import { useWorkspaceStore } from '@renderer/store/workspaceStore'

export function DirectoryPicker(): JSX.Element {
  const openWorkspace = useWorkspaceStore((s) => s.openWorkspace)

  const handleOpen = async (): Promise<void> => {
    const result = await window.api.invoke('dialog:openDirectory', undefined)
    const path = result as string | null
    if (path) {
      await openWorkspace(path)
    }
  }

  return (
    <button
      onClick={handleOpen}
      style={{
        padding: '10px 28px',
        borderRadius: 8,
        fontSize: 12,
        fontFamily: 'var(--mono)',
        cursor: 'pointer',
        transition: 'all .15s',
        border: '1px solid rgba(124,106,247,.35)',
        background: 'var(--accent-dim)',
        color: 'var(--accent2)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.background = 'rgba(124,106,247,.22)'
        el.style.borderColor = 'rgba(124,106,247,.55)'
        el.style.color = '#c4b5fd'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.background = 'var(--accent-dim)'
        el.style.borderColor = 'rgba(124,106,247,.35)'
        el.style.color = 'var(--accent2)'
      }}
    >
      <span style={{ fontSize: 14 }}>◈</span>
      <span>Open Directory</span>
    </button>
  )
}
