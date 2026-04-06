# Forge OS — Technology Landscape Research Report

> **Date:** April 2026
> **Scope:** Competitive landscape, technical building blocks, and open-source leverage points for Forge OS
> **Source Document:** `/Applications/Development/codrox-app/codrox.md`

---

## Table of Contents

1. [Existing Similar Tools and Competitive Differentiation](#1-existing-similar-tools-and-competitive-differentiation)
2. [Git Worktree Tooling](#2-git-worktree-tooling)
3. [PTY Management in Electron and Tauri](#3-pty-management-in-electron-and-tauri)
4. [Editor Embedding — Monaco vs CodeMirror 6](#4-editor-embedding--monaco-vs-codemirror-6)
5. [Claude Code Subprocess Integration](#5-claude-code-subprocess-integration)
6. [State Persistence Patterns](#6-state-persistence-patterns)
7. [Agent Orchestration Patterns](#7-agent-orchestration-patterns)
8. [Relevant Open Source Projects](#8-relevant-open-source-projects)
9. [Summary of Recommendations](#9-summary-of-recommendations)

---

## 1. Existing Similar Tools and Competitive Differentiation

### Landscape Overview

| Tool | Category | AI Integration | Multi-Agent | Worktree-Based | Lifecycle Phases | Primary UI |
|------|----------|---------------|-------------|----------------|-----------------|------------|
| **Cursor** | AI-enhanced IDE | Deep (inline, chat, composer) | No (single context) | No | No | VS Code fork |
| **Windsurf (Codeium)** | AI-enhanced IDE | Deep (Cascade flows) | Limited (Cascade steps) | No | No | VS Code fork |
| **Zed** | Native editor | Copilot + inline assist + ACP | Partial (ACP agents) | No | No | Custom (Rust/GPUI) |
| **Warp** | AI terminal | Terminal-native AI | No | No | No | Custom (Rust) |
| **Aider** | CLI coding assistant | CLI-based (multi-model) | No | No | No | Terminal |
| **Claude Code** | CLI agent | Full agent (tool use) | No (one session) | No | No | Terminal |
| **Continue.dev** | IDE extension | Multi-model chat + edit | No | No | No | VS Code/JetBrains extension |
| **Codex CLI (OpenAI)** | CLI agent | Full agent | No | No | No | Terminal |
| **Devin** | Autonomous agent | Full autonomous | Single agent | No | Partial (plan/execute) | Web dashboard |
| **Factory.ai** | Agent platform | Multi-agent pipelines | Yes (Droids) | No | Yes (workflow-based) | Web dashboard |
| **Forge OS** | Agent orchestration | Claude Code native | **Yes (parallel)** | **Yes (core primitive)** | **Yes (6-phase)** | Desktop app |

### Detailed Competitor Analysis

**Cursor** is the current market leader in AI-assisted coding. It forks VS Code and adds inline completions (Tab), a chat panel, and Composer mode for multi-file edits. Composer 1.5 (early 2026) handles multi-file edits with visual diffs. Strengths: familiar VS Code UX, fast inline suggestions, deep codebase indexing, good context passing. Weaknesses: fundamentally still a single-developer, single-context editor. No concept of parallel agent work. Composer is sequential. No structured lifecycle for feature development. Credit-based pricing since mid-2025.

**Windsurf (Codeium)** introduced "Cascade" flows that chain AI steps together (read files, edit, run commands). This is closer to agentic behavior than Cursor's Composer but still operates within a single workspace context. Offers the most autonomous AI experience among VS Code forks. No parallel execution. No worktree isolation. Most generous free tier among competitors.

**Zed** is a high-performance native editor written in Rust using GPUI. It introduced the **Agent Client Protocol (ACP)**, an open standard that lets external agents run inside Zed with full editor integration. GPU-accelerated, instant startup. Architecturally the most interesting competitor — ACP could allow Zed to add multi-agent support without building it from scratch. However, it currently has no worktree orchestration story.

**Warp** is a Rust-based terminal with AI command suggestions and "Warp Drive" for shared workflows. Relevant for its approach to modernizing terminal UX (blocks, command history, completions). Not a competitor to Forge OS but a strong reference for terminal tab design and PTY management at scale.

**Aider** is a CLI tool for pair-programming with LLMs. It has excellent git integration (auto-commits, diff-based editing) and multi-model support. Relevant pattern: it uses a "whole file" or "diff" editing format that could inform how Forge OS displays agent changes. However, it is single-session, single-context.

**Devin (Cognition)** is the closest competitor in vision. It provides a web-based environment where an autonomous agent plans, codes, tests, and debugs. It has a planning phase and execution tracking. Key differences from Forge OS: (1) Devin is cloud-hosted, not local; (2) single agent, not parallel; (3) no git worktree isolation; (4) opaque agent model, not Claude Code.

**Factory.ai** offers "Droids" — specialized AI agents for different software tasks (code review, migration, testing). This is the closest to Forge OS's multi-agent model, but it is a cloud platform with its own agent implementations, not a wrapper around Claude Code sessions.

### Forge OS Differentiation Summary

Forge OS occupies a unique position at the intersection of three capabilities no current tool combines:

1. **Parallel agent orchestration** — multiple Claude Code agents running simultaneously, each in isolation
2. **Git worktrees as the unit of parallelism** — real branch isolation, not just tabs
3. **Structured feature lifecycle** — 6-phase process (Propose through Verify) replacing freeform prompting

No existing tool treats worktrees as a first-class primitive for AI-driven development. No tool provides a structured lifecycle with phase-specific AI modes. The closest competitors (Devin, Factory) are cloud-hosted platforms with proprietary agents. Forge OS is local-first, built on Claude Code, and designed for the developer who wants to direct agents rather than be one.

**Strategic vulnerability:** Cursor or Zed (especially via ACP) could add parallel agent support within their existing ecosystems, neutralizing the differentiator without requiring users to abandon their editor. Speed to market matters.

---

## 2. Git Worktree Tooling

### Native Git Worktree Commands

Git's built-in worktree support (since Git 2.5, stable since 2.15+) provides the foundation:

```
git worktree add <path> -b <branch> <base>   # Create new worktree
git worktree list                              # List all worktrees
git worktree remove <path>                     # Remove a worktree
git worktree prune                             # Clean up stale references
git worktree lock/unlock <path>                # Prevent/allow pruning
```

Key constraints Forge OS must handle:
- A branch can only be checked out in one worktree at a time
- The main worktree (the original clone) cannot be removed via `git worktree remove`
- Worktrees share the `.git` directory (via a `.git` file pointing to `<repo>/.git/worktrees/<name>`)
- All worktrees share `.git/objects` — efficient but means disk I/O contention under heavy parallel use
- Submodules in worktrees require Git 2.36+ for proper support — consider excluding submodule repos from v1
- Locking: Git uses `.git/worktrees/<name>/locked` files. Parallel operations on the same repo need serialization for index-modifying commands
- Disk usage: each worktree is a full checkout (not a clone). For a 1GB repo with 6 worktrees, expect ~6GB disk

### Programmatic Libraries

| Library | Language | Approach | Worktree Support | Recommendation |
|---------|----------|----------|-----------------|----------------|
| **simple-git** | Node.js | Shell wrapper | Yes (via `.raw()` and `worktree()` method) | **Recommended** — mature, typed, active, async |
| **isomorphic-git** | Node.js | Pure JS implementation | No worktree support | Not suitable |
| **nodegit** (libgit2) | Node.js | Native bindings | Limited | Too heavy, compilation issues, low maintenance since 2023 |
| **dugite** | Node.js | Bundled git binary | Yes | Used by GitHub Desktop. Ships a git binary, reliable. Heavier install. |
| **git2-rs** | Rust | libgit2 bindings | Full | Best option if using Tauri. Well-maintained. |
| **gix (gitoxide)** | Rust | Pure Rust git | Yes (added) | High-performance pure Rust. Active development. |

### Recommended Approach

**For Electron:** Use `simple-git` for all git operations. It wraps the system git binary, supports all worktree operations, and handles async well. For worktree creation specifically, use explicit `git worktree add` via `simpleGit().raw(...)` since the typed API may not cover all worktree options. Wrap worktree commands in a `WorktreeManager` service with a serialization queue for index-modifying operations.

**For Tauri:** Use `git2-rs` (libgit2 bindings) for most operations, falling back to `std::process::Command` for worktree commands if libgit2's worktree API is insufficient. Alternatively, use `gix` for a pure-Rust path with better performance characteristics.

### Worktree Management Patterns

Forge OS should implement a worktree manager that handles:

1. **Naming convention:** `<repo-root>/../<repo-name>-wt-<branch-slug>/` — placing worktrees as siblings of the main repo avoids nesting issues.
2. **Lifecycle tracking:** Maintain a manifest (JSON or SQLite) mapping worktree paths to feature metadata (phase, agent assignment, creation time).
3. **Cleanup:** Worktrees left in a dirty state (crashed agent, interrupted implement phase) need a recovery flow — detect orphaned worktrees via `git worktree list` and offer to resume or discard.
4. **Branch protection:** Prevent creating a worktree on a branch that is already checked out elsewhere. Git enforces this, but Forge OS should surface the error clearly.

---

## 3. PTY Management in Electron and Tauri

### Core Components

| Component | Role | Platform |
|-----------|------|----------|
| **node-pty** | Spawn PTY processes from Node.js | Electron (main process) |
| **xterm.js 5** | Terminal emulator UI in the browser | Electron (renderer) / Tauri (webview) |
| **xterm-addon-fit** | Auto-resize terminal to container | Both |
| **xterm-addon-webgl** | GPU-accelerated rendering | Both |
| **xterm-addon-serialize** | Serialize terminal buffer | Both |
| **conpty** | Windows pseudo-console | Windows backend for node-pty |
| **portable-pty** | Rust PTY library | Tauri alternative to node-pty |
| **@loopmode/xpty** | React wrapper for xterm + node-pty | Simplifies multi-terminal Electron apps |

### Architecture: Electron

```
Main Process                    Renderer Process
+----------------+              +--------------------+
|  node-pty      |  IPC bridge  |  xterm.js          |
|  instances[]   | <----------> |  Terminal[]         |
|                | (data,resize)|  + fit addon        |
|  Per-worktree  |              |  + webgl addon      |
|  PTY pool      |              |                     |
+----------------+              +--------------------+
```

**node-pty** spawns a pseudoterminal for each session (requires Node 16+ or Electron 19+). For Forge OS, each worktree needs at minimum:
- 1 PTY for the terminal tab
- 1 PTY for the Claude Code session
- Optional additional PTYs for split terminals

With 4-6 worktrees active, this means 8-18 concurrent PTY sessions. This is well within OS limits (macOS allows thousands of PTY pairs) but requires careful memory management.

**IPC bridge pattern:** The main process holds `node-pty` instances. The renderer holds `xterm.js` instances. Use a single IPC channel with session ID discriminator, not N channels:
- `pty:data` — main sends stdout data to renderer (include session ID)
- `pty:input` — renderer sends keystrokes to main (include session ID)
- `pty:resize` — renderer sends terminal dimensions on container resize
- `pty:spawn` / `pty:kill` — lifecycle management

**Performance considerations:**
- **Memory:** Each PTY with scrollback buffer uses ~5-10 MB. 18 PTYs = 90-180 MB just for buffers.
- **Rendering:** Don't re-render xterm.js on every PTY data event. Use `requestAnimationFrame` throttling.
- **High-throughput output:** Claude Code streaming long responses can flood IPC. Batch data events with a small buffer (16ms debounce) and use `SharedArrayBuffer` or Electron's `MessagePort` for the hot path.
- **Suspension:** SIGSTOP inactive worktree PTYs. Buffer output to disk ring buffer. Resume (SIGCONT) when the user switches to that worktree.

### Architecture: Tauri

Tauri does not have Node.js in the backend — it runs Rust. Options:

1. **portable-pty (Rust crate):** The `portable-pty` crate provides cross-platform PTY support. Spawn PTYs from the Rust backend, pipe data to the webview via Tauri's event system or IPC commands.

2. **tauri-plugin-shell:** Tauri's built-in shell plugin can spawn processes, but it does not provide full PTY support (no terminal emulation, no resize signals). Insufficient for an interactive terminal.

3. **Custom PTY bridge:** Use `portable-pty` in the Rust backend, expose `spawn`, `write`, `resize`, `kill` commands to the frontend via Tauri's `invoke` mechanism. The frontend runs `xterm.js` in the webview.

**Tauri PTY challenge:** Tauri's IPC is message-based (JSON serialization). For high-throughput PTY data, this adds overhead compared to Electron's binary IPC. Mitigation: use Tauri's raw event streaming or a local WebSocket bridge between the Rust backend and the webview.

### Electron vs Tauri for PTY

| Factor | Electron | Tauri |
|--------|----------|-------|
| PTY ecosystem maturity | Excellent (node-pty is battle-tested, used by VS Code/Hyper) | Emerging (portable-pty works but less tooling) |
| xterm.js integration | Native (same JS runtime) | Works (webview), but IPC overhead for data |
| Multiple PTY sessions | Straightforward | Requires custom Rust bridge |
| Memory per PTY | ~5-10 MB per session (with scrollback) | ~2-5 MB per session (Rust is leaner) |
| Build complexity | Low (npm install node-pty) | Medium (Rust compilation, native deps) |
| Time to MVP | Faster | Slower |

**Recommendation for Phase 1 (MVP):** Use Electron with node-pty. The ecosystem is mature, the patterns are well-documented (VS Code, Hyper, Tabby all use this stack), and time-to-working-terminal is minimal. Implement PTY suspension for inactive worktrees from day one. Evaluate Tauri migration for Phase 4+ if bundle size and memory become priorities.

### Multi-PTY Session Management

Design a `PTYManager` class in the main process:

```typescript
class PTYManager {
  private sessions: Map<string, IPty> = new Map();

  create(id: string, cwd: string): IPty { /* spawn + register */ }
  write(id: string, data: string): void { /* route input */ }
  resize(id: string, cols: number, rows: number): void { /* resize */ }
  destroy(id: string): void { /* kill + cleanup */ }
  suspend(id: string): void { /* SIGSTOP for inactive */ }
  resume(id: string): void { /* SIGCONT when activated */ }
  listByWorktree(worktreeId: string): IPty[] { /* filter */ }
  destroyByWorktree(worktreeId: string): void { /* cleanup on archive */ }
}
```

---

## 4. Editor Embedding — Monaco vs CodeMirror 6

### Head-to-Head Comparison

| Factor | Monaco Editor | CodeMirror 6 |
|--------|--------------|--------------|
| **Origin** | Extracted from VS Code (Microsoft) | Ground-up rewrite by Marijn Haverbeke |
| **Bundle size** | ~2-5 MB (heavy, monolithic) | ~150-300 KB (modular, tree-shakeable) |
| **Multiple instances** | Expensive — each instance loads full language services | Lightweight — designed for many instances |
| **Diff view** | Built-in `DiffEditor` component, production-grade | Available via `@codemirror/merge`, functional but less polished |
| **Language support** | 70+ languages via TextMate grammars (same as VS Code) | 30+ via `@codemirror/lang-*` packages, extensible via Lezer grammars |
| **TypeScript support** | Full IntelliSense (tsserver integration, diagnostics) | Syntax highlighting only (no type checking, no LSP built-in) |
| **Theming** | VS Code themes work directly, limited customization | CSS-based, fully themeable |
| **Performance (large files)** | Good (virtual rendering) | Excellent (virtual rendering, lighter baseline, fast startup) |
| **Mobile/touch** | Poor | Good |
| **API style** | Imperative (similar to VS Code API) | Functional/declarative (state transactions) |
| **Framework integration** | Works anywhere, but opinionated | Framework-agnostic, composable |
| **Accessibility** | Good (inherits VS Code work) | Good (screen reader support) |
| **Read-only / viewer mode** | Full editor always loaded | Can configure as lightweight viewer |
| **Collaboration** | OT-based via Monaco binding | CRDT-friendly (Yjs bindings exist) |

### For Forge OS Specifically

Forge OS uses the editor primarily as a **file viewer with diff capabilities**, not as the primary authoring surface (agents write code, humans review it). This shifts the calculus significantly.

**Arguments for CodeMirror 6:**
- Multiple instances are cheap — each worktree may have several file tabs open simultaneously. With 4-6 worktrees, that could be 12-30 editor instances. Monaco would consume significant memory; CodeMirror handles this gracefully.
- The diff view via `@codemirror/merge` is sufficient for reviewing agent-written changes.
- Smaller bundle footprint means faster app startup.
- The modular architecture means you only load what you need (syntax highlighting, diff, read-only mode).
- Forge OS does not need IntelliSense — Claude Code handles code intelligence.
- If LSP features are needed later, CodeMirror 6 supports them via extensions.

**Arguments for Monaco:**
- The built-in `DiffEditor` is more polished than CodeMirror's merge view, with inline/side-by-side toggle, minimap, and bracket matching in diffs.
- If users want to occasionally edit code directly (not just review), Monaco provides a more familiar VS Code-like experience.
- Language support is broader out of the box.
- Go-to-definition, find references, and other navigation features work without custom setup for JS/TS.

### Recommendation

**Use CodeMirror 6.** The deciding factors are:

1. **Instance count:** Forge OS will have many simultaneous editor instances. CodeMirror's lightweight architecture is critical here.
2. **Primary role is viewing, not editing:** The editor is a review surface. Full IDE features (IntelliSense, refactoring) are unnecessary — Claude handles those tasks.
3. **Bundle size:** Forge OS already embeds a terminal emulator, multiple PTY sessions, and webviews. Keeping the editor lightweight matters.
4. **Diff view is sufficient:** `@codemirror/merge` provides side-by-side and inline diffs. It lacks Monaco's minimap-in-diff but this is not critical for code review.

If users demand a richer editing experience in later phases, Monaco can be loaded on-demand for a single "power editor" tab without replacing CodeMirror elsewhere.

---

## 5. Claude Code Subprocess Integration

### How Claude Code Runs

Claude Code is a CLI application (installed via `npm install -g @anthropic-ai/claude-code` or similar). It runs as an interactive terminal process:

```bash
claude           # Interactive REPL mode
claude -p "..."  # Non-interactive (print mode) — runs a single prompt
claude --resume  # Resume a previous session
```

Key characteristics:
- It is a **PTY-interactive process** — it reads/writes to a terminal, uses ANSI escape codes, handles terminal resize events.
- It maintains **session state** — conversation history, tool results, and file context are tracked per session.
- It uses **tool calls** — reads files, writes files, runs bash commands, searches code. These are visible in the terminal output.
- It has a **`--session-id`** flag for named sessions that can be resumed.
- It supports a **JSON output mode** (`--output-format json`) for programmatic consumption.

### Integration Options

| Approach | How | Structured Output | Reliability | Recommended Phase |
|----------|-----|-------------------|-------------|-------------------|
| **Claude Agent SDK** | JS/Python package, spawns Claude Code as subprocess, stdin/stdout JSON | Yes — first-class | High | **Phase 1+ (primary)** |
| **PTY passthrough** | Spawn `claude` in node-pty, pipe I/O to xterm.js | No (parse terminal output) | High (for display) | **Phase 1 (fallback/display)** |
| **Claude Code CLI flags** | Spawn `claude` process with `--output-format stream-json` | Parse stdout | Medium | Phase 2 (structured extraction) |
| **Anthropic API direct** | HTTP calls to Claude API | Full control | High | For non-agentic phases only |
| **MCP integration** | Claude Code as MCP client | Via tool calls | High | For tool-based interaction |

### Claude Agent SDK (Key Integration Path)

The **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk` for JS) is the recommended primary integration:

- Spawns Claude Code CLI as a subprocess
- Communicates via **structured JSON messages** over stdin/stdout
- Supports **real-time event streaming** for progress updates
- Provides **programmatic control** over sessions (start, send message, stop)
- Supports **MCP tool calls** as first-class citizens
- Enables **live session observability** (current tool, files being edited, task state)

This directly addresses the spec's open question about "how to detect task completion in Implement" — the SDK provides structured events for tool calls, file edits, and task progress.

### Spawning Multiple Sessions

For Forge OS, each worktree needs its own Claude Code session:

```
Worktree A (feat/auth)    ->  Agent Session 1  (cwd: /worktrees/auth)
Worktree B (feat/search)  ->  Agent Session 2  (cwd: /worktrees/search)
Worktree C (fix/perf)     ->  Agent Session 3  (cwd: /worktrees/perf)
```

Each session:
- Runs in its own subprocess (via SDK or PTY)
- Has its `cwd` set to the worktree directory
- Uses a unique session ID for conversation continuity
- Inherits the user's Anthropic API key from the environment

### Phase-Specific Claude Integration

| Phase | Integration Need | Approach |
|-------|-----------------|----------|
| Propose | Minimal — user fills form, Claude asks clarifying Qs | Send brief as initial prompt via SDK; parse response |
| Grill | Adversarial mode — needs system prompt control | Inject system prompt via SDK configuration or `--system-prompt` flag |
| Research | Claude reads codebase, returns typed findings | Send research prompt; consume structured SDK events |
| Plan | Claude generates task list | Send plan prompt; parse JSON task list from SDK output |
| Implement | Claude executes tasks autonomously | SDK event stream for progress + PTY passthrough for display |
| Verify | Claude runs tests, returns results | Send verify prompt; parse structured test results |

### Sending Input Programmatically

To drive Claude Code from Forge OS (not just passthrough user typing):

```javascript
// Via SDK: structured message sending
agentSession.sendMessage('Analyze the codebase for patterns related to authentication.');

// Via PTY: write to stdin (fallback)
ptySession.write('Analyze the codebase for patterns related to authentication.\n');
```

Both approaches work. The SDK path provides structured responses; the PTY path provides the raw terminal experience.

### Resource Considerations

Each Claude Code process:
- **Memory:** ~100-200 MB (Node.js process + conversation context)
- **CPU:** Mostly idle (waiting for API responses), spikes during tool execution
- **API usage:** Each session consumes tokens independently. 4 parallel agents = 4x token consumption.
- **Rate limits:** Anthropic API rate limits apply across all sessions. With 4-6 agents, plan for tier-appropriate rate limits. Implement request queuing and backoff.

**Recommendation:** Use the Claude Agent SDK as the primary integration layer. Each worktree gets an SDK-managed agent session. Phase-specific system prompts are injected via SDK configuration. Structured output (scores, findings, tasks) comes through SDK events, not stdout parsing. Keep a PTY passthrough for the terminal display of what the agent is doing.

---

## 6. State Persistence Patterns

### What Needs Persisting

| Data | Scope | Access Pattern | Size |
|------|-------|---------------|------|
| Worktree metadata | Per worktree | Read on switch, write on phase change | Small (< 1 KB) |
| Feature lifecycle phase | Per worktree | Frequent reads, occasional writes | Tiny |
| Propose brief | Per worktree | Write once, read many | Small (1-5 KB) |
| Grill transcript + scores | Per worktree | Append, then read | Medium (5-50 KB) |
| Research findings | Per worktree | Write batch, read many | Medium (10-100 KB) |
| Plan task list | Per worktree | Write, frequent updates during implement | Medium (5-30 KB) |
| Verify results | Per worktree | Write batch, read | Small (2-10 KB) |
| Agent panel state | Global | Frequent reads/writes (polling) | Small |
| Agent session history | Global | Append, query | Growing |
| UI layout preferences | Global | Read on startup | Tiny |
| Workspace config | Per workspace | Read on startup | Small |

### Option Comparison

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **JSON sidecar files** | Simple, human-readable, git-committable, no dependencies | No transactions, no queries, race conditions with concurrent writes, schema migration is manual | Per-worktree state (lifecycle, brief, findings) |
| **SQLite** (better-sqlite3) | ACID transactions, concurrent writes (WAL mode), queryable, single file | Binary format (not human-readable, not git-friendly), requires native module, schema migrations needed | Global app state, cross-worktree queries, task lists |
| **SQLite + JSON hybrid** | Best of both: queryable index in SQLite, detailed data in JSON files | Two systems to maintain | Recommended approach |
| **LevelDB / RocksDB** | Fast key-value store, embedded | Not human-readable, less queryable, native module | Not recommended for this use case |
| **Electron Store / conf** | Simple key-value, auto-persisted, typed | Not queryable, no concurrent access, poor for relational data | App preferences only |

### Recommended Architecture: Two-Tier Hybrid

**Tier 1 — JSON sidecar per worktree (lifecycle state):**
```
<worktree-root>/.forge/
  state.json          # { phase, createdAt, updatedAt, branch, featureName }
  propose.json        # { brief, clarifications }
  grill.json          # { transcript, scores }
  research.json       # { findings[] }
  plan.json           # { tasks[], effort }
  verify.json         # { results[], summary }
```

Advantages:
- Each worktree carries its own state — moving or archiving a worktree is self-contained.
- Human-readable — developers can inspect and debug state directly.
- Git-ignorable (add `.forge/` to `.gitignore`) — state does not pollute the repo.
- No cross-process locking needed — each worktree's state is written by one agent at a time.

**Tier 2 — SQLite for global/cross-cutting state:**
```
<app-data>/forge-os.db
  workspaces     (id, path, name, created_at)
  worktrees      (id, workspace_id, path, branch, phase, agent_status, updated_at)
  agent_sessions (id, worktree_id, started_at, ended_at, status, task_summary)
  events         (id, agent_session_id, type, payload, timestamp)  -- structured agent event log
  preferences    (key, value)
```

Advantages:
- Cross-worktree queries (e.g., "show all worktrees in Implement phase") are fast.
- Agent panel reads from a single source.
- ACID transactions prevent corruption from concurrent agent updates.
- WAL mode enables concurrent reads during agent writes.

**Implementation notes:**
- Use `better-sqlite3` (synchronous, fast, good Electron support) for Electron.
- For Tauri, use `rusqlite` or the `tauri-plugin-sql` with SQLite backend.
- JSON files are read/written with atomic write (write to temp file, then rename) to prevent corruption on crash.

---

## 7. Agent Orchestration Patterns

### Patterns from the Industry

**Pattern 1: Process-per-agent (Forge OS approach)**
Each agent is an independent OS process (Claude Code session) with its own filesystem context (worktree). Coordination happens at the UI layer, not between agents.

- Used by: oh-my-claudecode's team mode, manual multi-terminal Claude Code usage
- Pros: Full isolation, no shared state corruption, crash isolation
- Cons: No inter-agent communication, duplicate context loading, higher resource usage

**Pattern 2: Thread-per-agent with shared context**
A single orchestrator process spawns agent threads that share a common context store. Agents can read each other's outputs.

- Used by: AutoGen (Microsoft), CrewAI, LangGraph
- Pros: Agents can collaborate, shared knowledge base
- Cons: Shared state creates race conditions, harder to isolate failures

**Pattern 3: Event-driven pipeline**
Agents are stages in a pipeline. Each agent's output feeds the next agent's input. A message bus coordinates flow.

- Used by: Factory.ai Droids, custom LangChain pipelines
- Pros: Clear data flow, composable, retryable stages
- Cons: Not well-suited for parallel independent work (which is Forge OS's model)

**Pattern 4: Supervisor + worker pool**
A supervisor agent breaks work into tasks and delegates to worker agents. The supervisor monitors progress and handles failures.

- Used by: Devin (internally), Claude's multi-agent SDK patterns, Claude MPM
- Pros: Central coordination, dynamic task allocation
- Cons: Supervisor is a bottleneck, single point of failure

### Forge OS's Position

Forge OS uses **Pattern 1 (process-per-agent)** with a **human supervisor** (the developer). This is a deliberate design choice:

- The developer is the orchestrator — they assign tasks, review output, advance phases.
- Agents do not need to communicate with each other — each works on an independent feature in an isolated worktree.
- Crash isolation is critical — one agent failing should not affect others.
- Resource management is simpler — kill a process, free its resources.
- Graceful degradation: if an agent crashes, its worktree state is preserved. User can restart or reassign.

The agent panel serves as the coordination layer that Pattern 2/4 would provide via software. The human reviews the panel and makes routing decisions.

### Comparison with Multi-Agent Frameworks

| Framework | Agent Model | Communication | Orchestration | Forge OS Relevance |
|-----------|-------------|---------------|---------------|-------------------|
| **AutoGen** | Python agents, conversation-based | Inter-agent chat | Flexible (round-robin, hierarchical) | Low — Forge OS agents are isolated |
| **CrewAI** | Role-based agents, tool-equipped | Shared memory + delegation | Sequential or hierarchical | Low — different paradigm. Role concept maps to phase-specific Claude modes. |
| **LangGraph** | State machine with agent nodes | Graph edges (state transitions) | Graph-based | Medium — lifecycle phases are a state machine |
| **Claude Agent SDK** | Tool-using agents, delegation | Parent-child delegation | Hierarchical | High — primary integration layer for spawning/managing agents |
| **Claude MPM** | Lead agent coordinates workers via SDK | Structured messages | Supervisor pattern | Medium — reference for multi-agent orchestration with Claude |
| **MetaGPT** | Software-role agents (PM, architect, engineer) | Document-based (PRDs, design docs) | Sequential pipeline | Medium — lifecycle phases resemble MetaGPT's role pipeline |

### State Machine for Lifecycle

The 6-phase lifecycle (Propose -> Grill -> Research -> Plan -> Implement -> Verify) is a finite state machine. Libraries for managing this:

| Library | Language | Notes |
|---------|----------|-------|
| **XState** | TypeScript | Industry-standard FSM/statechart library. Supports guards, actions, nested states. Well-suited for lifecycle phases with entry/exit conditions. |
| **Robot** | TypeScript | Lightweight FSM (2 KB). Simpler than XState. May be sufficient if lifecycle logic stays simple. |
| **zustand + immer** | TypeScript | Not an FSM library but can model state transitions with middleware. Less structured. |

**Recommendation:** Use **XState** for the lifecycle state machine. It provides:
- Visual state chart debugging (XState Inspector)
- Guards for exit conditions (e.g., "all findings reviewed" before advancing from Research)
- Actions on transitions (e.g., "inject Grill system prompt" when entering Grill phase)
- Persistence — XState state can be serialized to JSON and restored
- Parallel states — each worktree has its own machine instance

**Recommendation for orchestration:** Implement a simple supervisor pattern in the Electron main process. Don't use an orchestration framework — the overhead isn't justified for 4-6 agents with independent worktrees. The Claude Agent SDK already handles the hard parts (subprocess management, structured events, session state).

---

## 8. Relevant Open Source Projects

### Directly Leverageable

| Project | What It Provides | How Forge OS Uses It | License |
|---------|-----------------|---------------------|---------|
| **xterm.js** | Terminal emulator for the web | Terminal tabs + Claude Code display | MIT |
| **node-pty** | PTY spawning from Node.js | Backend for all terminal sessions | MIT |
| **simple-git** | Git operations from Node.js | Worktree management, branch operations | MIT |
| **CodeMirror 6** | Code editor | File viewer + diff view tabs | MIT |
| **@codemirror/merge** | Diff/merge view | Git change review per worktree | MIT |
| **XState** | Finite state machines | Lifecycle phase management | MIT |
| **better-sqlite3** | SQLite for Node.js | Global state persistence | MIT |
| **electron-store** | Simple persistence | User preferences | MIT |
| **xterm-addon-fit** | Terminal auto-resize | Terminal UX | MIT |
| **xterm-addon-webgl** | GPU terminal rendering | Performance for heavy output | MIT |

### Reference Implementations

| Project | Relevance | Key Takeaway |
|---------|-----------|-------------|
| **Hyper** (terminal) | Electron + node-pty + xterm.js architecture | PTY management patterns, plugin architecture |
| **Tabby** (terminal) | Electron terminal with split panes, profiles | Multi-session terminal UX, session persistence |
| **VS Code** (editor) | Monaco integration, multi-panel layout, integrated terminal | Layout management, editor lifecycle, terminal integration |
| **GitHub Desktop** | Electron + dugite for git operations | Git subprocess management, worktree-aware UI |
| **Zed** (open source) | Rust-based editor with ACP | Agent Client Protocol design, GPU-accelerated rendering |
| **Theia** | VS Code-compatible IDE framework | Modular IDE architecture, multi-view layout, extension hosting |
| **Claude MPM** | Multi-agent project manager | SDK-based agent orchestration patterns |
| **gitworktree.nvim** | Neovim worktree plugin | Worktree management UX patterns |

### Potentially Useful Libraries

| Library | Purpose | When to Adopt |
|---------|---------|--------------|
| **electron-vite** | Electron build tooling with Vite | Phase 1 — project scaffolding |
| **@electron/rebuild** | Native module rebuilding | Phase 1 — node-pty compilation |
| **zustand** | Lightweight state management | Phase 1 — UI state (worktree selection, tab state, IPC-friendly) |
| **react-resizable-panels** | Resizable panel layout | Phase 1 — sidebar + main + agent panel |
| **cmdk** | Command palette component | Phase 1 — Cmd+K palette |
| **chokidar** | File watching | Phase 1 — file tree updates |
| **@loopmode/xpty** | React + xterm + node-pty wrapper | Phase 1 — quick terminal setup reference |
| **diff** (npm) | Text diff computation | Phase 2 — computing diffs for editor display |
| **tree-sitter** (WASM) | Syntax parsing | Phase 3+ — structured code analysis for research phase |

---

## 9. Summary of Recommendations

### Decision Matrix

| Decision | Recommendation | Confidence | Rationale |
|----------|---------------|------------|-----------|
| App framework | **Electron** (Phase 1-3), evaluate Tauri for Phase 4+ | High | PTY ecosystem maturity, faster MVP, proven patterns (VS Code, Hyper) |
| Editor | **CodeMirror 6** | High | Multi-instance performance, bundle size, review-oriented use case |
| Claude integration | **Claude Agent SDK** (primary) + **PTY passthrough** (display) | High | Structured I/O, event streaming, session observability |
| Git library | **simple-git** | High | Mature, async, typed, covers all worktree operations |
| Terminal | **xterm.js 5 + node-pty** with custom PTYManager | High | No viable alternative for Electron |
| State (per-worktree) | **JSON sidecar files** in `.forge/` | High | Self-contained, human-readable, portable |
| State (global) | **better-sqlite3** (WAL mode) | Medium-High | Cross-worktree queries, ACID, concurrent agent updates |
| Lifecycle FSM | **XState** | High | Guards, persistence, visual debugging, industry standard |
| Orchestration | **Custom supervisor** in main process (no framework) | Medium | SDK handles hard parts; framework overhead not justified for 4-6 agents |
| UI state | **zustand** | Medium | Lightweight, React-friendly, IPC-friendly |
| Layout | **react-resizable-panels** | Medium | Handles the 3-column layout with resize handles |
| Command palette | **cmdk** | Medium | Small, composable, keyboard-first |

### Key Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cursor/Zed adds parallel agent support | High | Ship worktree orchestration fast; consider whether Forge OS should also work as an extension |
| Claude Code output parsing is fragile | Medium | Use Agent SDK for structured I/O; fall back to PTY passthrough for display only |
| 4-6 concurrent Claude sessions hit API rate limits | Medium | Implement request queuing and backoff in supervisor; surface rate-limit warnings in agent panel |
| node-pty native compilation failures on some platforms | Low | Use `@electron/rebuild`; test on macOS, Linux, Windows CI |
| xterm.js performance with many terminals open | Low | Lazy-render inactive terminals; SIGSTOP inactive PTYs; only pipe data to visible xterm instance |
| SQLite native module + Electron packaging | Low | `better-sqlite3` has good Electron support; use electron-builder's native module config |
| Worktree cleanup on crash | Medium | On startup, reconcile `git worktree list` with SQLite manifest; offer recovery for orphaned worktrees |
| Disk usage with many worktrees | Low | Surface disk usage in UI; offer archive/cleanup for completed worktrees |

### Build Order (Technology Adoption by Phase)

**Phase 1 — Core Shell:**
- Electron + electron-vite
- React + zustand
- xterm.js + node-pty (terminal tab + Claude session)
- Claude Agent SDK (primary Claude integration)
- CodeMirror 6 (editor tab)
- simple-git (file tree, basic git status)
- chokidar (file watching)
- react-resizable-panels (layout)
- cmdk (command palette)
- electron-store (preferences)

**Phase 2 — Worktree Parallelism:**
- simple-git worktree operations (create/list/remove)
- PTYManager (multi-session orchestration with suspension)
- better-sqlite3 (global worktree registry, agent sessions)
- JSON sidecar files (per-worktree state in `.forge/`)

**Phase 3 — Feature Lifecycle:**
- XState (lifecycle state machine per worktree)
- @codemirror/merge (diff view)
- Agent SDK event parsing (structured progress, scores, task lists)
- Phase-specific system prompt injection via SDK

**Phase 4 — Polish:**
- Webview tab (Electron BrowserView or webview tag)
- PR creation via `gh` CLI or GitHub API
- Worktree archive/cleanup automation
- Multi-workspace support

---

## Sources

- [Windsurf vs Cursor vs Zed: Which AI IDE in 2026?](https://www.octavehq.com/post/windsurf-vs-cursor-vs-zed-which-ai-ide-in-2026)
- [The Ultimate AI Code Editor Comparison 2026](https://devgent.org/en/ai-code-editor-comparison-cursor-zed-windsurf-antigravity-kiro-developer-guide/)
- [node-pty — npm](https://www.npmjs.com/package/node-pty)
- [microsoft/node-pty — GitHub](https://github.com/microsoft/node-pty)
- [xterm.js](https://xtermjs.org/)
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude Code overview](https://code.claude.com/docs/en/overview)
- [anthropics/claude-agent-sdk-python — GitHub](https://github.com/anthropics/claude-agent-sdk-python)
- [Claude MPM — GitHub](https://github.com/bobmatnyc/claude-mpm)
- [CodeMirror 6](https://codemirror.net/)
- [XState](https://stately.ai/docs/xstate)
- [simple-git — npm](https://www.npmjs.com/package/simple-git)
- [better-sqlite3 — npm](https://www.npmjs.com/package/better-sqlite3)

---

*This report integrates findings from web research and established patterns in the Electron, terminal emulator, and AI tooling ecosystems. Specific version numbers should be verified against the latest releases at implementation time.*
