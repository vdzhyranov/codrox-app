import { useEffect, useRef, useState } from 'react'
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
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { EditorTab as EditorTabType } from '@shared/types'

function isMarkdownFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase()
  return ext === 'md' || ext === 'markdown' || ext === 'mdx'
}

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

const previewStyles = `
  .md-preview {
    padding: 32px 40px;
    height: 100%;
    overflow-y: auto;
    background: var(--surface);
    color: var(--text);
    font-family: var(--sans);
    font-size: 15px;
    line-height: 1.7;
  }
  .md-preview h1, .md-preview h2, .md-preview h3,
  .md-preview h4, .md-preview h5, .md-preview h6 {
    font-family: var(--sans);
    color: var(--text);
    font-weight: 700;
    margin: 1.5em 0 0.5em;
    line-height: 1.3;
  }
  .md-preview h1 { font-size: 2em; }
  .md-preview h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
  .md-preview h3 { font-size: 1.25em; }
  .md-preview h4 { font-size: 1.1em; }
  .md-preview p { margin: 0.75em 0; }
  .md-preview a { color: var(--accent2); text-decoration: none; }
  .md-preview a:hover { text-decoration: underline; }
  .md-preview code {
    font-family: var(--mono);
    font-size: 0.88em;
    background: var(--surface2);
    padding: 0.15em 0.4em;
    border-radius: 4px;
    color: var(--accent2);
  }
  .md-preview pre {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1em 1.25em;
    overflow-x: auto;
    margin: 1em 0;
  }
  .md-preview pre code {
    background: none;
    padding: 0;
    color: var(--text);
    font-size: 0.85em;
  }
  .md-preview blockquote {
    border-left: 3px solid var(--accent);
    background: var(--accent-dim);
    margin: 1em 0;
    padding: 0.5em 1em;
    border-radius: 0 4px 4px 0;
    color: var(--text2);
  }
  .md-preview blockquote p { margin: 0; }
  .md-preview ul, .md-preview ol {
    padding-left: 1.75em;
    margin: 0.75em 0;
  }
  .md-preview li { margin: 0.25em 0; }
  .md-preview table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 0.92em;
  }
  .md-preview th, .md-preview td {
    border: 1px solid var(--border);
    padding: 0.5em 0.75em;
    text-align: left;
  }
  .md-preview th {
    background: var(--surface2);
    font-weight: 600;
    color: var(--text);
  }
  .md-preview tr:nth-child(even) td { background: var(--surface2); }
  .md-preview hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 1.5em 0;
  }
  .md-preview img { max-width: 100%; border-radius: 4px; }
`

export function EditorTab({ tab }: { tab: EditorTabType }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'raw' | 'preview'>('raw')
  const [content, setContent] = useState<string>('')
  const [modified, setModified] = useState(false)
  const [saving, setSaving] = useState(false)
  const isMd = isMarkdownFile(tab.filePath)

  const save = async (): Promise<void> => {
    const view = viewRef.current
    if (!view || !modified) return
    setSaving(true)
    try {
      const text = view.state.doc.toString()
      await window.api.invoke('fs:writeFile', { path: tab.filePath, content: text })
      if (isMd) setContent(text)
      setModified(false)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let view: EditorView | null = null

    const loadFile = async (): Promise<void> => {
      try {
        const result = (await window.api.invoke('fs:readFile', {
          path: tab.filePath
        })) as { content: string }

        setContent(result.content)
        setModified(false)

        const lang = getLanguageExtension(tab.filePath)

        const state = EditorState.create({
          doc: result.content,
          extensions: [
            basicSetup,
            oneDark,
            lang,
            EditorView.theme({
              '&': { height: '100%', fontSize: '13px' },
              '.cm-scroller': { overflow: 'auto' },
              '.cm-content': { fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace" }
            }),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                setModified(true)
              }
            }),
          ]
        })

        view = new EditorView({ state, parent: container })
        viewRef.current = view
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file')
        setLoading(false)
      }
    }

    loadFile()

    return () => {
      view?.destroy()
    }
  }, [tab.filePath])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-400">
        {error}
      </div>
    )
  }


  return (
    <div
      className="h-full w-full overflow-hidden bg-zinc-900"
      style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
          e.preventDefault()
          save()
        }
      }}
    >
      {!loading && (
        <>
          {isMd && <style>{previewStyles}</style>}
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '14px',
            zIndex: 10,
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
          }}>
            {modified && (
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontFamily: 'var(--mono)',
                  fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer',
                  border: '1px solid var(--accent)',
                  borderRadius: '6px',
                  background: 'var(--accent-dim)',
                  color: 'var(--accent2)',
                  opacity: saving ? 0.6 : 1,
                  transition: 'all 0.15s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
              >
                {saving ? 'Saving...' : '● Save'}
              </button>
            )}
            {isMd && (
              <div style={{
                display: 'flex',
                gap: '2px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
              }}>
                {(['raw', 'preview'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      padding: '3px 12px',
                      fontSize: '11px',
                      fontFamily: 'var(--mono)',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: 'none',
                      background: mode === m ? 'var(--accent-dim)' : 'var(--surface2)',
                      color: mode === m ? 'var(--accent2)' : 'var(--text3)',
                      transition: 'background 0.15s, color 0.15s',
                      textTransform: 'capitalize'
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {loading && (
        <div className="flex h-full items-center justify-center text-xs text-zinc-500">
          Loading...
        </div>
      )}

      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ display: loading || (isMd && mode === 'preview') ? 'none' : 'block', flex: 1 }}
      />

      {isMd && mode === 'preview' && !loading && (
        <div className="md-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
