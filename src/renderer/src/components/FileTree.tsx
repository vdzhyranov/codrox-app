import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import type { FileTreeNode } from '@shared/types/filesystem'

function getFileIcon(name: string): { icon: string; color: string } {
  const lower = name.toLowerCase()
  const ext = name.split('.').pop()?.toLowerCase()

  // Special filenames
  if (lower === 'dockerfile') return { icon: '◆', color: '#2496ed' }
  if (lower === '.gitignore' || lower === '.gitattributes') return { icon: '◈', color: '#7c7c7c' }
  if (lower === '.env' || lower.startsWith('.env.')) return { icon: '⚿', color: '#ecc94b' }
  if (lower === 'package.json' || lower === 'package-lock.json') return { icon: '◉', color: '#cb3837' }
  if (lower === 'tsconfig.json' || lower.startsWith('tsconfig')) return { icon: '⊤', color: '#3178c6' }
  if (lower === 'vite.config.ts' || lower === 'vite.config.js') return { icon: '⚡', color: '#646cff' }

  switch (ext) {
    case 'ts':   return { icon: '⊤', color: '#3178c6' }
    case 'tsx':  return { icon: '⊤', color: '#61dafb' }
    case 'js':   return { icon: '⟁', color: '#f7df1e' }
    case 'jsx':  return { icon: '⟁', color: '#61dafb' }
    case 'json': return { icon: '◩', color: '#a8cc6c' }
    case 'css':  return { icon: '#', color: '#42a5f5' }
    case 'scss': return { icon: '#', color: '#f06292' }
    case 'less': return { icon: '#', color: '#f06292' }
    case 'html': return { icon: '◇', color: '#e44d26' }
    case 'md':   return { icon: '¶', color: '#519aba' }
    case 'mdx':  return { icon: '¶', color: '#519aba' }
    case 'yaml': return { icon: '≡', color: '#cc3333' }
    case 'yml':  return { icon: '≡', color: '#cc3333' }
    case 'sh':   return { icon: '›_', color: '#4ec94e' }
    case 'bash': return { icon: '›_', color: '#4ec94e' }
    case 'zsh':  return { icon: '›_', color: '#4ec94e' }
    case 'py':   return { icon: '⊙', color: '#3572a5' }
    case 'go':   return { icon: '⊞', color: '#00add8' }
    case 'rs':   return { icon: '⊛', color: '#dea584' }
    case 'svg':  return { icon: '◎', color: '#4ec94e' }
    case 'png':  return { icon: '▣', color: '#a855f7' }
    case 'jpg':  return { icon: '▣', color: '#a855f7' }
    case 'jpeg': return { icon: '▣', color: '#a855f7' }
    case 'gif':  return { icon: '▣', color: '#a855f7' }
    case 'webp': return { icon: '▣', color: '#a855f7' }
    case 'ico':  return { icon: '▣', color: '#a855f7' }
    case 'lock': return { icon: '⊟', color: '#7c7c7c' }
    case 'toml': return { icon: '≡', color: '#9c4221' }
    case 'xml':  return { icon: '◇', color: '#e44d26' }
    case 'sql':  return { icon: '⊞', color: '#336791' }
    case 'graphql': return { icon: '◈', color: '#e10098' }
    case 'gql':  return { icon: '◈', color: '#e10098' }
    case 'env':  return { icon: '⚿', color: '#ecc94b' }
    case 'txt':  return { icon: '≡', color: '#888888' }
    case 'log':  return { icon: '≡', color: '#888888' }
    default:     return { icon: '○', color: '#888888' }
  }
}

const DIMMED_NAMES = new Set([
  'node_modules', '.git', 'dist', 'out', 'build', '.next', '.cache', '.turbo', 'coverage',
])

const ALLOWED_DOT_FILES = new Set(['.env', '.gitignore', '.claude', '.gitattributes'])

function isDimmed(name: string): boolean {
  if (DIMMED_NAMES.has(name)) return true
  if (name.startsWith('.') && !ALLOWED_DOT_FILES.has(name) && !name.startsWith('.env.')) return true
  return false
}

function sortChildren(children: FileTreeNode[]): FileTreeNode[] {
  return [...children].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === 'directory' ? -1 : 1
  })
}

const GIT_STATUS_CONFIG: Record<string, { color: string; symbol: string }> = {
  modified: { color: 'var(--amber)', symbol: '●' },
  added: { color: 'var(--green)', symbol: '+' },
  deleted: { color: 'var(--red)', symbol: '−' },
  untracked: { color: 'var(--text3)', symbol: '?' },
  renamed: { color: 'var(--blue)', symbol: '→' },
}

function getGitIndicator(status?: string): JSX.Element | null {
  if (!status || status === 'clean') return null
  const cfg = GIT_STATUS_CONFIG[status]
  if (!cfg) return null
  return (
    <span
      style={{
        marginLeft: 'auto',
        fontSize: 'var(--fs-sm)',
        color: cfg.color,
        flexShrink: 0,
      }}
    >
      {cfg.symbol}
    </span>
  )
}

function TreeNode({ node, depth }: { node: FileTreeNode; depth: number }): JSX.Element {
  const activeWorktreePath = useActiveWorktreePath()
  const isExpanded = useFileTreeStore((s) =>
    activeWorktreePath ? s.isExpanded(activeWorktreePath, node.path) : false
  )
  const toggleExpand = useFileTreeStore((s) => s.toggleExpand)
  const openFile = useFileTreeStore((s) => s.openFile)

  const handleClick = (): void => {
    if (!activeWorktreePath) return
    if (node.type === 'directory') {
      toggleExpand(activeWorktreePath, node.path)
    } else {
      openFile(node.path)
    }
  }

  const isDir = node.type === 'directory'
  const dimmed = isDimmed(node.name)
  const fileIconData = getFileIcon(node.name)
  const sortedChildren = node.children ? sortChildren(node.children) : []

  return (
    <div style={{ opacity: dimmed ? 0.4 : 1 }}>
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          paddingTop: 2,
          paddingBottom: 2,
          paddingLeft: `${depth * 12 + 10}px`,
          paddingRight: 10,
          cursor: 'pointer',
          fontSize: 'var(--fs-md)',
          color: isDir ? 'var(--text2)' : 'var(--text3)',
          transition: 'all .1s',
          borderRadius: 4,
          margin: '0 4px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface2)'
          e.currentTarget.style.color = 'var(--text)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = isDir ? 'var(--text2)' : 'var(--text3)'
        }}
      >
        {/* chevron for dirs, nothing for files (keeps alignment) */}
        <span
          style={{
            width: 10,
            fontSize: 'var(--fs-xs)',
            color: 'var(--text3)',
            flexShrink: 0,
            textAlign: 'center',
          }}
        >
          {isDir ? (isExpanded ? '▾' : '▸') : ''}
        </span>
        {/* folder or file icon */}
        <span
          style={{
            width: 14,
            fontSize: 'var(--fs-icon)',
            color: isDir ? '#fbbf24' : fileIconData.color,
            flexShrink: 0,
            textAlign: 'center',
            lineHeight: 1,
          }}
        >
          {isDir ? (isExpanded ? '\u{1F4C2}' : '\u{1F4C1}') : fileIconData.icon}
        </span>
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: isDir ? 500 : 400,
          }}
        >
          {node.name}
        </span>
        {getGitIndicator(node.gitStatus)}
      </div>
      {isDir && isExpanded && sortedChildren.length > 0 && (
        <div>
          {sortedChildren.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

interface SearchResult {
  name: string
  path: string
  relativePath: string
}

interface ContentResult {
  name: string
  path: string
  relativePath: string
  line: number
  lineContent: string
}

type SearchMode = 'files' | 'content'

function FileSearch({ rootPath }: { rootPath: string }): JSX.Element {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('files')
  const [fileResults, setFileResults] = useState<SearchResult[]>([])
  const [contentResults, setContentResults] = useState<ContentResult[]>([])
  const [searching, setSearching] = useState(false)
  const openFile = useFileTreeStore((s) => s.openFile)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback((q: string, m: SearchMode) => {
    if (!q.trim()) {
      setFileResults([])
      setContentResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    if (m === 'files') {
      window.api.invoke('fs:search', { rootPath, query: q.trim(), limit: 30 })
        .then((res) => {
          setFileResults(res as SearchResult[])
          setSearching(false)
        })
        .catch(() => { setFileResults([]); setSearching(false) })
    } else {
      window.api.invoke('fs:searchContent', { rootPath, query: q.trim(), limit: 30 })
        .then((res) => {
          setContentResults(res as ContentResult[])
          setSearching(false)
        })
        .catch(() => { setContentResults([]); setSearching(false) })
    }
  }, [rootPath])

  const handleChange = (value: string): void => {
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(value, mode), mode === 'content' ? 400 : 200)
  }

  const toggleMode = (): void => {
    const next = mode === 'files' ? 'content' : 'files'
    setMode(next)
    setFileResults([])
    setContentResults([])
    if (query.trim()) {
      doSearch(query, next)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      setQuery('')
      setFileResults([])
      setContentResults([])
    }
  }

  const results = mode === 'files' ? fileResults : contentResults
  const hasResults = results.length > 0

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ padding: '6px 8px', display: 'flex', gap: 4 }}>
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'files' ? 'Search files...' : 'Search in files...'}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: 'var(--fs-md)',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text)',
            fontFamily: 'var(--mono)',
            outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
        />
        <button
          onClick={toggleMode}
          title={mode === 'files' ? 'Switch to content search' : 'Switch to filename search'}
          style={{
            padding: '2px 6px',
            fontSize: 'var(--fs-sm)',
            background: mode === 'content' ? 'var(--accent-dim)' : 'var(--surface2)',
            border: `1px solid ${mode === 'content' ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 4,
            color: mode === 'content' ? 'var(--accent2)' : 'var(--text3)',
            fontFamily: 'var(--mono)',
            cursor: 'pointer',
            flexShrink: 0,
            fontWeight: 600,
          }}
        >
          Aa
        </button>
      </div>
      {query.trim() && (
        <div style={{ maxHeight: 280, overflowY: 'auto', paddingBottom: 4 }}>
          {searching && (
            <div style={{ padding: '4px 12px', fontSize: 'var(--fs-sm)', color: 'var(--text3)' }}>
              Searching...
            </div>
          )}
          {!searching && !hasResults && (
            <div style={{ padding: '4px 12px', fontSize: 'var(--fs-sm)', color: 'var(--text3)' }}>
              No results
            </div>
          )}
          {mode === 'files' && fileResults.map((r) => {
            const fileIcon = getFileIcon(r.name)
            return (
              <div
                key={r.path}
                onClick={() => { openFile(r.path); setQuery(''); setFileResults([]) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 12px',
                  cursor: 'pointer',
                  fontSize: 'var(--fs-md)',
                  color: 'var(--text2)',
                  transition: 'all .1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
              >
                <span style={{ color: fileIcon.color, fontSize: 'var(--fs-icon)', width: 14, textAlign: 'center', flexShrink: 0 }}>
                  {fileIcon.icon}
                </span>
                <span style={{ fontWeight: 500, flexShrink: 0 }}>{r.name}</span>
                <span style={{ color: 'var(--text3)', fontSize: 'var(--fs-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.relativePath}
                </span>
              </div>
            )
          })}
          {mode === 'content' && contentResults.map((r, i) => {
            const fileIcon = getFileIcon(r.name)
            return (
              <div
                key={`${r.path}:${r.line}:${i}`}
                onClick={() => { openFile(r.path); setQuery(''); setContentResults([]) }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: 'var(--fs-md)',
                  color: 'var(--text2)',
                  transition: 'all .1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: fileIcon.color, fontSize: 'var(--fs-icon)', width: 14, textAlign: 'center', flexShrink: 0 }}>
                    {fileIcon.icon}
                  </span>
                  <span style={{ fontWeight: 500, flexShrink: 0 }}>{r.relativePath}</span>
                  <span style={{ color: 'var(--text3)', fontSize: 'var(--fs-xs)', flexShrink: 0 }}>:{r.line}</span>
                </div>
                <div style={{
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--text3)',
                  paddingLeft: 20,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {r.lineContent}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function FileTree(): JSX.Element {
  const activeWorktreePath = useActiveWorktreePath()
  const tree = useFileTreeStore((s) =>
    activeWorktreePath ? s.treeByWorktree[activeWorktreePath] : null
  )
  const setTree = useFileTreeStore((s) => s.setTree)

  useEffect(() => {
    if (!activeWorktreePath) return
    window.api.invoke('fs:readDir', { path: activeWorktreePath }).then((result) => {
      setTree(activeWorktreePath, result as FileTreeNode)
    })
  }, [activeWorktreePath, setTree])

  if (!tree) {
    return (
      <div style={{ padding: 12, fontSize: 'var(--fs-md)', color: 'var(--text3)' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {activeWorktreePath && <FileSearch rootPath={activeWorktreePath} />}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4, paddingBottom: 4 }}>
        {sortChildren(tree.children ?? []).map((child) => (
          <TreeNode key={child.path} node={child} depth={0} />
        ))}
      </div>
    </div>
  )
}
