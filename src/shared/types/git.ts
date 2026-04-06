import type { GitStatusType } from './filesystem'

export interface GitFileStatus {
  path: string
  status: GitStatusType
  staged: boolean
}

export interface GitDiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  content: string
}

export interface GitDiff {
  filePath: string
  hunks: GitDiffHunk[]
}
