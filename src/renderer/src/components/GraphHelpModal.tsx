import type { GraphStats } from '@shared/types/graph'

interface Props {
  onClose: () => void
  stats: GraphStats | null
}

const SECTION_GAP = 14

export function GraphHelpModal({ onClose, stats }: Props): JSX.Element {
  return (
    <div
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '20px 22px',
          width: 620,
          maxHeight: '82vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: SECTION_GAP,
          color: 'var(--text)'
        }}
      >
        <Header onClose={onClose} stats={stats} />
        <Section title="What is the knowledge graph?">
          <P>
            Every workspace has its own SQLite graph at{' '}
            <Code>&lt;workspace&gt;/.codrox/knowledge.db</Code>. It captures the
            structure of your repo (files, symbols, imports), its history (commits,
            who modified what), the agent activity that runs against it (Claude
            sessions, files they touched), and concepts you or Claude define.
          </P>
          <P>
            The graph is per-workspace, lives next to your code, and uses SQLite
            WAL mode so the app and Claude can read & write it concurrently.
          </P>
        </Section>

        <Section title="Node types">
          <Legend
            items={[
              { color: '#3b82f6', label: 'file', desc: 'A source file in the repo' },
              { color: '#a855f7', label: 'symbol', desc: 'Function/class/interface defined inside a file' },
              { color: '#22c55e', label: 'commit', desc: 'A git commit reachable from HEAD' },
              { color: '#eab308', label: 'agent_session', desc: 'A Claude (or sub-agent) run that worked here' },
              { color: '#06b6d4', label: 'concept', desc: 'A named idea — captured by you or by Claude' }
            ]}
          />
        </Section>

        <Section title="Edges">
          <UL>
            <li>
              <Code>imports</Code> — file → file (parsed from source)
            </li>
            <li>
              <Code>defines</Code> — file → symbol
            </li>
            <li>
              <Code>calls</Code> — symbol → symbol (Claude can assert these)
            </li>
            <li>
              <Code>modifiedBy</Code> — file → commit
            </li>
            <li>
              <Code>workedOn</Code> — agent_session → file
            </li>
            <li>
              <Code>relatedTo</Code> — free-form link (e.g. concept → file)
            </li>
          </UL>
        </Section>

        <Section title="Two authors: indexer vs Claude">
          <P>
            Every node and edge is stamped with a <Code>source</Code>. The local
            indexer writes <Code>source: 'indexer'</Code>; Claude (via MCP) writes{' '}
            <Code>source: 'claude'</Code>. Reindexing only replaces indexer-owned
            rows, so concepts and annotations Claude created are <em>preserved</em>{' '}
            forever.
          </P>
          <P>
            In the graph view, Claude-authored nodes get an{' '}
            <span
              style={{
                display: 'inline-block',
                padding: '0 4px',
                borderRadius: 3,
                background: '#f97316',
                color: '#fff',
                fontWeight: 700,
                fontSize: 10
              }}
            >
              C
            </span>{' '}
            badge with an orange ring; Claude-authored edges render as orange
            dashed lines.
          </P>
        </Section>

        <Section title="How Claude reads & writes the graph">
          <P>
            When a workspace is set up, Codrox writes a{' '}
            <Code>.claude/.mcp.json</Code> next to <Code>CLAUDE.md</Code>. Any
            Claude Code instance launched inside the workspace auto-spawns the
            bundled <Code>codrox-graph</Code> MCP server, giving it stdio access
            to the same SQLite file. Available tools:
          </P>
          <Table
            rows={[
              ['graph_search', 'read', 'FTS5 search across labels + meta'],
              ['graph_neighbors', 'read', '1-hop traversal (in/out/both)'],
              ['graph_get_node', 'read', 'Fetch a single node'],
              ['graph_stats', 'read', 'Counts + last-indexed timestamp + Claude attribution'],
              ['graph_add_concept', 'write', 'Create a concept node, optionally linked to files'],
              ['graph_link', 'write', 'Assert a relatedTo / calls edge between two nodes'],
              ['graph_annotate', 'write', 'Append a timestamped note to a node']
            ]}
          />
          <P>
            <strong>Guardrails:</strong> Claude can only assert{' '}
            <Code>relatedTo</Code> or <Code>calls</Code> — it can&apos;t fabricate
            <Code> imports</Code>/<Code>defines</Code> claims that contradict the
            parser. The MCP server also refuses to attach if the schema version
            doesn&apos;t match.
          </P>
        </Section>

        <Section title="How to use">
          <UL>
            <li>
              <strong>Search</strong> — type into the search box; matches highlight
              nodes in the canvas.
            </li>
            <li>
              <strong>Click a node</strong> — replaces the view with that
              node&apos;s 1-hop neighbors.
            </li>
            <li>
              <strong>Reindex</strong> — re-walk the workspace; Claude-authored
              rows survive.
            </li>
            <li>
              <strong>Inside Claude</strong> — ask “what concepts have I captured
              about X?”, “annotate this file”, or “link these two files as
              related”. Claude calls the MCP tools directly.
            </li>
          </UL>
        </Section>
      </div>
    </div>
  )
}

function Header({ onClose, stats }: { onClose: () => void; stats: GraphStats | null }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Knowledge Graph</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          {stats
            ? `${stats.nodeCount} nodes · ${stats.edgeCount} edges · ${stats.claudeNodeCount} Claude-authored nodes / ${stats.claudeEdgeCount} edges`
            : 'No stats yet'}
        </span>
      </div>
      <button
        onClick={onClose}
        title="Close"
        style={{
          background: 'none',
          border: '1px solid var(--border)',
          color: 'var(--text3)',
          fontSize: 11,
          padding: '2px 10px',
          borderRadius: 5,
          cursor: 'pointer'
        }}
      >
        Close
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text3)'
        }}
      >
        {title}
      </span>
      {children}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text2)', margin: 0 }}>
      {children}
    </p>
  )
}

function UL({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <ul
      style={{
        margin: 0,
        paddingLeft: 18,
        fontSize: 12,
        lineHeight: 1.55,
        color: 'var(--text2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }}
    >
      {children}
    </ul>
  )
}

function Code({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <code
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 11,
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 3,
        padding: '0 4px'
      }}
    >
      {children}
    </code>
  )
}

interface LegendItem {
  color: string
  label: string
  desc: string
}

function Legend({ items }: { items: LegendItem[] }): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px 16px',
        fontSize: 12,
        color: 'var(--text2)'
      }}
    >
      {items.map((it) => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: it.color,
              flexShrink: 0
            }}
          />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)' }}>
            {it.label}
          </span>
          <span style={{ color: 'var(--text3)', fontSize: 11 }}>{it.desc}</span>
        </div>
      ))}
    </div>
  )
}

function Table({ rows }: { rows: Array<[string, string, string]> }): JSX.Element {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 5,
        overflow: 'hidden',
        fontSize: 11
      }}
    >
      {rows.map(([name, kind, desc], i) => (
        <div
          key={name}
          style={{
            display: 'grid',
            gridTemplateColumns: '170px 60px 1fr',
            gap: 8,
            padding: '5px 10px',
            background: i % 2 === 0 ? 'var(--surface2)' : 'transparent',
            color: 'var(--text2)'
          }}
        >
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{name}</span>
          <span
            style={{
              color: kind === 'write' ? '#f97316' : 'var(--text3)',
              fontWeight: 600,
              textTransform: 'uppercase',
              fontSize: 9,
              alignSelf: 'center'
            }}
          >
            {kind}
          </span>
          <span style={{ color: 'var(--text3)' }}>{desc}</span>
        </div>
      ))}
    </div>
  )
}
