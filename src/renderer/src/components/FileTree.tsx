import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { useEffect } from 'react'
import { useWorkspaceStore } from '@renderer/store/workspaceStore'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { useTabStore } from '@renderer/store/tabStore'
import type { FileTreeNode } from '@shared/types/filesystem'
import type { EditorTab } from '@shared/types/tabs'

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts': case 'tsx': return '⊤'
    case 'js': case 'jsx': return '⟁'
    case 'json': return '{}'
    case 'css': return '#'
    case 'html': return '<>'
    case 'md': return '¶'
    default: return '○'
  }
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
  const openTab = useTabStore((s) => s.openTab)

  const handleClick = (): void => {
    if (!activeWorktreePath) return
    if (node.type === 'directory') {
      toggleExpand(activeWorktreePath, node.path)
    } else {
      const tabId = `editor-${node.path}`
      const tab: EditorTab = {
        id: tabId,
        type: 'editor',
        title: node.name,
        worktreeId: activeWorktreePath,
        filePath: node.path,
        isDirty: false
      }
      openTab(activeWorktreePath, tab)
    }
  }

  const isDir = node.type === 'directory'

  return (
    <div>
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
        {isDir ? (
          <span style={{ width: 12, color: 'var(--text3)', fontSize: 9, flexShrink: 0 }}>
            {isExpanded ? '▾' : '▸'}
          </span>
        ) : (
          <span style={{ width: 12, color: 'var(--text3)', fontSize: 9, flexShrink: 0, textAlign: 'center' }}>
            {getFileIcon(node.name)}
          </span>
        )}
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
      {isDir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
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
      {tree.children?.map((child) => (
        <TreeNode key={child.path} node={child} depth={0} />
      ))}
    </div>
  )
}
