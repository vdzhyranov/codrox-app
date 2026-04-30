import { useState, useEffect } from 'react'
import { useWorkspaceSettingsStore } from '@renderer/store/workspaceSettingsStore'
import type { WorkspaceSettings, IssueTracker, ClaudeSettingsMode } from '@shared/types'

interface Props {
  workspaceId: string
  workspacePath: string
  onClose: () => void
}

export function WorkspaceSettingsModal({ workspaceId, workspacePath, onClose }: Props): JSX.Element {
  const loadSettings = useWorkspaceSettingsStore((s) => s.loadSettings)
  const saveSettings = useWorkspaceSettingsStore((s) => s.saveSettings)
  const cachedSettings = useWorkspaceSettingsStore((s) => s.getSettings(workspaceId))

  const [settings, setSettings] = useState<WorkspaceSettings>(cachedSettings)
  const [remoteBranches, setRemoteBranches] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)

  useEffect(() => {
    loadSettings(workspaceId).then(setSettings).catch(() => {})
    window.api.invoke('workspace:listRemoteBranches', { workspacePath })
      .then((branches) => setRemoteBranches(branches as string[]))
      .catch(() => {})
  }, [workspaceId, workspacePath])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await saveSettings(workspaceId, settings)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') onClose()
  }

  const setMainBranch = (branch: string | null): void => {
    setSettings((s) => ({ ...s, git: { mainBranch: branch } }))
    setShowBranchDropdown(false)
  }

  const setSettingsMode = (settingsMode: ClaudeSettingsMode): void => {
    setSettings((s) => ({ ...s, claude: { settingsMode } }))
  }

  const setIssueTracker = (issueTracker: IssueTracker): void => {
    setSettings((s) => ({ ...s, integrations: { issueTracker } }))
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
          width: 380,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            Workspace Settings
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text3)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: '0 2px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Section: Git */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionLabel>Git</SectionLabel>

            <SettingRow label="Main branch" hint="Base for new worktrees">
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowBranchDropdown((v) => !v)}
                  style={{
                    width: '100%',
                    padding: '5px 10px',
                    fontSize: 12,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    color: settings.git.mainBranch ? 'var(--accent2)' : 'var(--text3)',
                    fontFamily: 'var(--mono)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                  }}
                >
                  <span>{settings.git.mainBranch ?? 'auto (origin/HEAD)'}</span>
                  <span style={{ fontSize: 9, color: 'var(--text3)' }}>▾</span>
                </button>
                {showBranchDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 10,
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      marginTop: 2,
                      maxHeight: 180,
                      overflowY: 'auto',
                      boxShadow: '0 4px 12px rgba(0,0,0,.3)',
                    }}
                  >
                    <DropdownItem
                      active={!settings.git.mainBranch}
                      italic
                      onClick={() => setMainBranch(null)}
                    >
                      auto (origin/HEAD)
                    </DropdownItem>
                    {remoteBranches.map((b) => (
                      <DropdownItem
                        key={b}
                        active={settings.git.mainBranch === b}
                        onClick={() => setMainBranch(b)}
                      >
                        {b}
                      </DropdownItem>
                    ))}
                  </div>
                )}
              </div>
            </SettingRow>
          </div>

          <Divider />

          {/* Section: Claude */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionLabel>Claude</SectionLabel>

            <SettingRow label="Settings scope" hint="Where Claude config is stored">
              <SegmentedControl
                options={[
                  { value: 'workspace', label: 'Workspace' },
                  { value: 'global', label: 'Global (~/.claude)' },
                ]}
                value={settings.claude.settingsMode}
                onChange={(v) => setSettingsMode(v as ClaudeSettingsMode)}
              />
            </SettingRow>
            {settings.claude.settingsMode === 'global' && (
              <p style={{ fontSize: 10, color: 'var(--text3)', margin: '2px 0 0', lineHeight: 1.5 }}>
                Claude will share auth, history, and config across all workspaces using global mode.
              </p>
            )}
          </div>

          <Divider />

          {/* Section: Integrations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionLabel>Integrations</SectionLabel>

            <SettingRow label="Issue tracker" hint="Shown in the sidebar for this workspace">
              <SegmentedControl
                options={[
                  { value: 'linear', label: 'Linear' },
                  { value: 'github', label: 'GitHub' },
                  { value: 'none', label: 'None' },
                ]}
                value={settings.integrations.issueTracker}
                onChange={(v) => setIssueTracker(v as IssueTracker)}
              />
            </SettingRow>
            {settings.integrations.issueTracker === 'github' && (
              <p style={{ fontSize: 10, color: 'var(--text3)', margin: '2px 0 0', lineHeight: 1.5 }}>
                GitHub Issues integration coming soon.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text3)',
              fontSize: 11,
              padding: '5px 14px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 5,
              color: '#fff',
              fontSize: 11,
              padding: '5px 14px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.1em',
        color: 'var(--text3)',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  )
}

function Divider(): JSX.Element {
  return <div style={{ height: 1, background: 'var(--border)' }} />
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 11, color: 'var(--text2)' }}>{label}</span>
        {hint && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function DropdownItem({
  active,
  italic,
  onClick,
  children,
}: {
  active: boolean
  italic?: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '5px 10px',
        fontSize: 12,
        fontFamily: 'var(--mono)',
        color: active ? 'var(--accent2)' : 'var(--text2)',
        cursor: 'pointer',
        fontStyle: italic ? 'italic' : 'normal',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface3)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </div>
  )
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {options.map((opt, i) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              padding: '5px 8px',
              fontSize: 11,
              fontFamily: 'var(--mono)',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
              border: 'none',
              borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
              color: isActive ? 'var(--accent2)' : 'var(--text3)',
              cursor: 'pointer',
              transition: 'all .12s',
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
