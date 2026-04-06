export type GitStatusType = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'clean'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  gitStatus?: GitStatusType
}

export interface FileChangeEvent {
  type: 'create' | 'update' | 'delete'
  path: string
}
