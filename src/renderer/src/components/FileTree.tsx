import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useEffect } from 'react'
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
    case 'json': return { icon: '{ }', color: '#a8cc6c' }
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
        fontSize: 10,
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
          fontSize: 11,
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
            fontSize: 9,
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
            fontSize: 12,
            color: isDir ? '#fbbf24' : fileIconData.color,
            flexShrink: 0,
            textAlign: 'center',
            lineHeight: 1,
          }}
        >
          {isDir ? (isExpanded ? '' : '') : fileIconData.icon}
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
      <div style={{ padding: 12, fontSize: 11, color: 'var(--text3)' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 4, paddingBottom: 4 }}>
      {sortChildren(tree.children ?? []).map((child) => (
        <TreeNode key={child.path} node={child} depth={0} />
      ))}
    </div>
  )
}
