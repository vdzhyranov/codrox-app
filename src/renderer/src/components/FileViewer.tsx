import { useState, useEffect, useRef, useCallback } from 'react'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { useActiveWorktreePath } from '@renderer/hooks/useActiveWorktreePath'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { rust } from '@codemirror/lang-rust'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'

// ── Simple Markdown Renderer ──────────────────────────────────────────────────

function formatInline(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = []
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[1]) {
      parts.push(<strong key={key++}>{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[4]}</em>)
    } else if (match[5]) {
      parts.push(
        <code
          key={key++}
          style={{
            background: 'var(--surface2)',
            padding: '1px 4px',
            borderRadius: 3,
            fontSize: '0.9em',
          }}
        >
          {match[6]}
        </code>,
      )
    } else if (match[7]) {
      parts.push(
        <span key={key++} style={{ color: 'var(--accent2)' }}>
          {match[8]}
        </span>,
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

function MarkdownView({ content }: { content: string }): JSX.Element {
  const lines = content.split('\n')
  const elements: JSX.Element[] = []
  let inCodeBlock = false
  let codeLines: string[] = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={key++}
            style={{
              background: 'var(--surface2)',
              padding: '8px 12px',
              borderRadius: 4,
              overflow: 'auto',
              fontSize: 11,
              margin: '4px 0',
              border: '1px solid var(--border)',
            }}
          >
            <code>{codeLines.join('\n')}</code>
          </pre>,
        )
        codeLines = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3
          key={key++}
          style={{
            fontSize: 13,
            fontWeight: 700,
            margin: '12px 0 4px',
            color: 'var(--text)',
          }}
        >
          {formatInline(line.slice(4))}
        </h3>,
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2
          key={key++}
          style={{
            fontSize: 14,
            fontWeight: 700,
            margin: '14px 0 4px',
            color: 'var(--text)',
          }}
        >
          {formatInline(line.slice(3))}
        </h2>,
      )
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1
          key={key++}
          style={{
            fontSize: 16,
            fontWeight: 800,
            margin: '16px 0 6px',
            color: 'var(--text)',
          }}
        >
          {formatInline(line.slice(2))}
        </h1>,
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 6, paddingLeft: 8 }}>
          <span style={{ color: 'var(--text3)', flexShrink: 0 }}>•</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>,
      )
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)$/)
      if (match) {
        elements.push(
          <div key={key++} style={{ display: 'flex', gap: 6, paddingLeft: 8 }}>
            <span style={{ color: 'var(--text3)', flexShrink: 0 }}>
              {match[1]}.
            </span>
            <span>{formatInline(match[2])}</span>
          </div>,
        )
      }
    } else if (line.startsWith('> ')) {
      elements.push(
        <div
          key={key++}
          style={{
            borderLeft: '3px solid var(--accent)',
            paddingLeft: 10,
            color: 'var(--text2)',
            margin: '4px 0',
          }}
        >
          {formatInline(line.slice(2))}
        </div>,
      )
    } else if (line.trim() === '') {
      elements.push(<div key={key++} style={{ height: 8 }} />)
    } else if (line.startsWith('---') || line.startsWith('***')) {
      elements.push(
        <hr
          key={key++}
          style={{
            border: 'none',
            borderTop: '1px solid var(--border)',
            margin: '8px 0',
          }}
        />,
      )
    } else {
      elements.push(
        <p key={key++} style={{ margin: '2px 0' }}>
          {formatInline(line)}
        </p>,
      )
    }
  }

  // Flush remaining code block
  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <pre
        key={key++}
        style={{
          background: 'var(--surface2)',
          padding: '8px 12px',
          borderRadius: 4,
          overflow: 'auto',
          fontSize: 11,
          border: '1px solid var(--border)',
        }}
      >
        <code>{codeLines.join('\n')}</code>
      </pre>,
    )
  }

  return (
    <div
      style={{
        fontSize: 12,
        color: 'var(--text)',
        lineHeight: 1.6,
        fontFamily: 'var(--mono)',
      }}
    >
      {elements}
    </div>
  )
}

// ── FileViewer ────────────────────────────────────────────────────────────────

// ── DiffView (GitHub-style) ──────────────────────────────────────────────────

function DiffView({ diff }: { diff: string }): JSX.Element {
  const lines = diff.split('\n')
  const containerRef = useRef<HTMLDivElement>(null)
  const hunkRefs = useRef<(HTMLDivElement | null)[]>([])
  const [currentHunk, setCurrentHunk] = useState(0)

  // Find hunk line indices (lines starting with @@)
  const hunkIndices = lines
    .map((line, i) => (line.startsWith('@@') ? i : -1))
    .filter((i) => i !== -1)

  const jumpToHunk = (direction: 1 | -1): void => {
    if (hunkIndices.length === 0) return
    const next = Math.max(0, Math.min(hunkIndices.length - 1, currentHunk + direction))
    setCurrentHunk(next)
    hunkRefs.current[hunkIndices[next]]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Navigation bar */}
      {hunkIndices.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => jumpToHunk(-1)}
            disabled={currentHunk <= 0}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 3,
              color: currentHunk > 0 ? 'var(--text2)' : 'var(--text3)',
              cursor: currentHunk > 0 ? 'pointer' : 'default',
              fontSize: 10,
              padding: '1px 6px',
              fontFamily: 'var(--mono)',
            }}
          >
            ↑ Prev
          </button>
          <button
            onClick={() => jumpToHunk(1)}
            disabled={currentHunk >= hunkIndices.length - 1}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 3,
              color: currentHunk < hunkIndices.length - 1 ? 'var(--text2)' : 'var(--text3)',
              cursor: currentHunk < hunkIndices.length - 1 ? 'pointer' : 'default',
              fontSize: 10,
              padding: '1px 6px',
              fontFamily: 'var(--mono)',
            }}
          >
            ↓ Next
          </button>
          <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            Change {currentHunk + 1} of {hunkIndices.length}
          </span>
        </div>
      )}

      {/* Diff content */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          fontSize: 11,
          fontFamily: 'var(--mono)',
          lineHeight: 1.6,
          minHeight: 0,
        }}
      >
        {lines.map((line, i) => {
          let bg = 'transparent'
          let color = 'var(--text)'
          let borderColor = 'transparent'

          if (line.startsWith('+++') || line.startsWith('---')) {
            color = 'var(--text2)'
            bg = 'var(--surface2)'
          } else if (line.startsWith('@@')) {
            color = 'var(--blue)'
            bg = 'rgba(96, 165, 250, 0.08)'
            borderColor = 'var(--blue)'
          } else if (line.startsWith('+')) {
            color = '#d4ffd4'
            bg = 'rgba(34, 197, 94, 0.22)'
            borderColor = '#22c55e'
          } else if (line.startsWith('-')) {
            color = '#ffd4d4'
            bg = 'rgba(239, 68, 68, 0.22)'
            borderColor = '#ef4444'
          } else if (line.startsWith('diff ') || line.startsWith('index ')) {
            color = 'var(--text3)'
            bg = 'var(--surface2)'
          }

          return (
            <div
              key={i}
              ref={(el) => { hunkRefs.current[i] = el }}
              style={{
                background: bg,
                color,
                padding: '0 12px 0 8px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                borderLeft: `3px solid ${borderColor}`,
                minHeight: 18,
              }}
            >
              {line || '\u00A0'}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CodeEditor ────────────────────────────────────────────────────────────────

function getLanguageExtension(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'js': case 'jsx': return javascript({ jsx: true })
    case 'ts': case 'tsx': return javascript({ jsx: true, typescript: true })
    case 'py': return python()
    case 'json': return json()
    case 'html': return html()
    case 'css': return css()
    case 'rs': return rust()
    case 'md': case 'markdown': case 'mdx': return markdown({ codeLanguages: languages })
    default: return []
  }
}

function CodeEditor({
  content,
  filePath,
  onChangeRef,
  onModified,
}: {
  content: string
  filePath: string
  onChangeRef: React.MutableRefObject<string>
  onModified: () => void
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const lang = getLanguageExtension(filePath)
    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        oneDark,
        lang,
        EditorView.theme({
          '&': { height: '100%', fontSize: '12px' },
          '.cm-editor': { height: '100%' },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current = update.state.doc.toString()
            onModified()
          }
        }),
      ],
    })

    const view = new EditorView({ state, parent: container })
    return () => view.destroy()
  }, [filePath, content])

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
}

// ── FileViewer ────────────────────────────────────────────────────────────────

type ViewMode = 'content' | 'diff'

export function FileViewer(): JSX.Element {
  const activeTab = useFileTreeStore((s) => s.activeTab)
  const activeWorktreePath = useActiveWorktreePath()
  const filePath = activeTab === 'work' ? null : activeTab
  const [content, setContent] = useState<string | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mdRaw, setMdRaw] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('content')
  const [modified, setModified] = useState(false)
  const [saving, setSaving] = useState(false)
  const editorContentRef = useRef<string>('')

  const save = useCallback(async () => {
    if (!filePath || !modified) return
    setSaving(true)
    try {
      await window.api.invoke('fs:writeFile', { path: filePath, content: editorContentRef.current })
      setModified(false)
    } finally {
      setSaving(false)
    }
  }, [filePath, modified])

  useEffect(() => {
    if (!filePath) {
      setContent(null)
      setDiff(null)
      setError(null)
      setModified(false)
      return
    }

    setLoading(true)
    setError(null)
    setModified(false)

    // Load file content
    const loadContent = window.api
      .invoke('fs:readFile', { path: filePath })
      .then((result) => {
        const r = result as { content: string }
        setContent(r.content)
        editorContentRef.current = r.content
      })
      .catch(() => setContent(null))

    // Load diff if in a worktree — git needs relative path
    const relativePath = activeWorktreePath && filePath.startsWith(activeWorktreePath)
      ? filePath.slice(activeWorktreePath.length + 1)
      : filePath
    const loadDiff = activeWorktreePath
      ? window.api
          .invoke('git:diff', { worktreePath: activeWorktreePath, filePath: relativePath })
          .then((result) => {
            const r = result as { diff: string }
            const d = r.diff
            setDiff(d && d.trim() ? d : null)
          })
          .catch(() => setDiff(null))
      : Promise.resolve()

    Promise.all([loadContent, loadDiff])
      .then(() => setLoading(false))
      .catch(() => setLoading(false))
  }, [filePath, activeWorktreePath])

  if (!filePath) {
    return (
      <div
        style={{
          padding: 16,
          fontSize: 11,
          color: 'var(--text3)',
          textAlign: 'center',
        }}
      >
        Click a file to preview
      </div>
    )
  }

  const fileName = filePath.split('/').pop() ?? ''
  const isMarkdown = /\.md$/i.test(fileName)
  const hasDiff = diff !== null

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
          e.preventDefault()
          save()
        }
      }}
    >
      {/* File name bar */}
      <div
        style={{
          padding: '4px 12px',
          fontSize: 10,
          fontFamily: 'var(--mono)',
          fontWeight: 600,
          color: 'var(--text2)',
          letterSpacing: '0.04em',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface2)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ color: 'var(--text3)' }}>
          {isMarkdown ? '¶' : '○'}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName}
        </span>
        {modified && (
          <span style={{ color: 'var(--accent2)', fontSize: 9, flexShrink: 0 }}>●</span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexShrink: 0 }}>
          {/* Save button */}
          {modified && (
            <button
              onClick={save}
              disabled={saving}
              style={{
                fontSize: 8,
                padding: '1px 6px',
                borderRadius: 2,
                background: 'var(--accent-dim)',
                color: 'var(--accent2)',
                border: '1px solid var(--accent)',
                cursor: saving ? 'default' : 'pointer',
                fontFamily: 'var(--mono)',
                fontWeight: 600,
                opacity: saving ? 0.6 : 1,
                transition: 'all .1s',
              }}
            >
              {saving ? 'SAVING...' : 'SAVE'}
            </button>
          )}
          {/* Diff toggle */}
          {hasDiff && (
            <button
              onClick={() => setViewMode((m) => m === 'diff' ? 'content' : 'diff')}
              style={{
                fontSize: 8,
                padding: '1px 6px',
                borderRadius: 2,
                background: viewMode === 'diff' ? 'var(--amber-dim)' : 'var(--surface3)',
                color: viewMode === 'diff' ? 'var(--amber)' : 'var(--text3)',
                border: viewMode === 'diff' ? '1px solid var(--amber)' : '1px solid var(--border)',
                cursor: 'pointer',
                fontFamily: 'var(--mono)',
                fontWeight: 600,
                transition: 'all .1s',
              }}
            >
              DIFF
            </button>
          )}
          {/* MD toggle */}
          {isMarkdown && viewMode === 'content' && (
            <button
              onClick={() => setMdRaw((r) => !r)}
              style={{
                fontSize: 8,
                padding: '1px 6px',
                borderRadius: 2,
                background: mdRaw ? 'var(--surface3)' : 'var(--accent-dim)',
                color: mdRaw ? 'var(--text2)' : 'var(--accent2)',
                border: mdRaw ? '1px solid var(--border)' : '1px solid var(--accent)',
                cursor: 'pointer',
                fontFamily: 'var(--mono)',
                fontWeight: 600,
                transition: 'all .1s',
              }}
            >
              {mdRaw ? 'RAW' : 'PREVIEW'}
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          padding: 0,
          minHeight: 0,
        }}
      >
        {loading && (
          <div style={{ fontSize: 11, color: 'var(--text3)', padding: '8px 12px' }}>Loading...</div>
        )}
        {error && (
          <div style={{ fontSize: 11, color: 'var(--red)', padding: '8px 12px' }}>
            Failed to read file
          </div>
        )}
        {!loading && !error && viewMode === 'diff' && diff && (
          <DiffView diff={diff} />
        )}
        {!loading && !error && viewMode === 'content' && content !== null && (
          isMarkdown && !mdRaw ? (
            <div style={{ padding: '8px 12px', height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
              <MarkdownView content={content} />
            </div>
          ) : (
            <CodeEditor
              key={filePath}
              content={content}
              filePath={filePath}
              onChangeRef={editorContentRef}
              onModified={() => setModified(true)}
            />
          )
        )}
      </div>
    </div>
  )
}
