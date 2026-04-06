## Forge OS -- Strategic Architecture Review

**Reviewer:** Architect agent
**Date:** 2026-04-05
**Source document:** `/Applications/Development/codrox-app/codrox.md`
**Status:** Design phase review -- no implementation code exists yet

---

## 1. Architecture Assessment

### Layout Zone Evaluation

The spec defines a three-column layout (Worktree Sidebar 220px | Main Content flex | Agent Panel 260-280px) described at `codrox.md:40-61`.

```
 STRENGTHS                              CONCERNS
 +-------------------------------+     +----------------------------------+
 | Three-zone layout matches     |     | Fixed pixel widths (220px,      |
 | the mental model: navigate,   |     | 260px) will break on smaller    |
 | work, monitor                 |     | displays and external monitors  |
 +-------------------------------+     +----------------------------------+
 | Phase Track bar gives         |     | Phase Chat "within right panel" |
 | persistent orientation        |     | (line 87) competes for space    |
 | across all worktrees          |     | with Agent Cards -- unclear     |
 +-------------------------------+     | how both fit in 260px           |
 | Tab-per-worktree isolation    |     +----------------------------------+
 | prevents cross-contamination  |     | No mention of responsive        |
 +-------------------------------+     | breakpoints or panel collapse   |
                                       +----------------------------------+
```

**Specific issue at `codrox.md:78-90`:** The Agent Panel serves two competing roles -- (a) showing live cards for ALL running agents across ALL worktrees, and (b) hosting Phase Chat for the CURRENT worktree. At 260px width, with 4-6 agent cards each needing ~80px height plus a chat interface, vertical real estate will be severely constrained. These should be separate panels or use a tab/accordion pattern within the right zone.

### Data Flow Architecture (not specified)

The spec describes UI layout but does not define data flow. The implied architecture is:

```
┌──────────────────────────────────────────────────────────┐
│                    RENDERER PROCESS                       │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  ┌────────────┐  │
│  │Worktree │  │  Main    │  │ Agent  │  │  Phase     │  │
│  │Sidebar  │  │ Content  │  │ Panel  │  │  State     │  │
│  └────┬────┘  └────┬─────┘  └───┬────┘  └─────┬──────┘  │
│       │            │            │              │          │
│       └────────────┴────────────┴──────────────┘          │
│                         │  IPC                            │
├─────────────────────────┼────────────────────────────────┤
│                    MAIN PROCESS                           │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐             │
│  │  Git     │  │  PTY      │  │ Lifecycle │             │
│  │ Worktree │  │ Manager   │  │  State    │             │
│  │ Manager  │  │ (Claude + │  │  Engine   │             │
│  │          │  │ Terminal) │  │           │             │
│  └──────────┘  └───────────┘  └───────────┘             │
│       │              │              │                     │
│  ┌────┴──────────────┴──────────────┴──────────┐         │
│  │           File System / Git / OS            │         │
│  └─────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────┘
```

**This data flow is not stated anywhere in the spec and must be explicitly designed.** The relationships between PTY manager, lifecycle state engine, and git worktree manager are the critical seams of this system.

---

## 2. Technology Decisions

### 2.1 Electron vs Tauri Decision Matrix

Referenced as open question at `codrox.md:452`.

```
┌─────────────────────┬────────────────────────┬────────────────────────┐
│ Criterion           │ Electron               │ Tauri                  │
├─────────────────────┼────────────────────────┼────────────────────────┤
│ PTY integration     │ node-pty: mature,      │ portable-pty (Rust):   │
│                     │ battle-tested, used by │ less ecosystem, need   │
│                     │ VS Code, Hyper, etc.   │ custom FFI bridge      │
├─────────────────────┼────────────────────────┼────────────────────────┤
│ Claude Code subproc │ child_process.spawn()  │ Rust Command + sidecar │
│                     │ -- trivial             │ -- more boilerplate    │
├─────────────────────┼────────────────────────┼────────────────────────┤
│ Monaco/CodeMirror   │ Native webview, just   │ Same -- both run in    │
│                     │ works                  │ webview                │
├─────────────────────┼────────────────────────┼────────────────────────┤
│ Memory per instance │ ~150-300 MB baseline   │ ~30-80 MB baseline     │
│                     │ + Chromium overhead     │ uses OS webview        │
├─────────────────────┼────────────────────────┼────────────────────────┤
│ Memory with 4-6     │ Critical concern:      │ Smaller baseline       │
│ PTY + Claude procs  │ Electron + 6 PTYs +   │ leaves more headroom   │
│                     │ 6 Claude procs = heavy │ for subprocesses       │
├─────────────────────┼────────────────────────┼────────────────────────┤
│ Bundle size         │ ~150 MB+               │ ~10-15 MB              │
├─────────────────────┼────────────────────────┼────────────────────────┤
│ macOS integration   │ Good                   │ Better (native webview)│
├─────────────────────┼────────────────────────┼────────────────────────┤
│ Dev velocity (MVP)  │ FAST -- huge ecosystem │ Slower -- Rust backend │
│                     │ TS throughout           │ + TS frontend          │
├─────────────────────┼────────────────────────┼────────────────────────┤
│ Webview tab         │ BrowserView/webview    │ Multi-webview is       │
│ (codrox.md:309)     │ tag -- well supported  │ experimental           │
├─────────────────────┼────────────────────────┼────────────────────────┤
│ IPC model           │ contextBridge +        │ Tauri commands (Rust   │
│                     │ ipcMain/ipcRenderer    │ -> JS invoke) -- typed │
├─────────────────────┼────────────────────────┼────────────────────────┤
│ Risk profile        │ Known quantities,      │ Less ecosystem for PTY,│
│                     │ proven at scale        │ multi-webview gaps     │
└─────────────────────┴────────────────────────┴────────────────────────┘
```

**RECOMMENDATION: Electron for MVP (Phase 1-2), evaluate Tauri migration for v2.**

Rationale: The spec at `codrox.md:395` lists `node-pty` explicitly. PTY management is the hardest systems-level integration in this app. node-pty in Electron is proven (VS Code, Hyper, Warp's early versions). Tauri's portable-pty is less mature and would require a Rust sidecar for PTY management, adding complexity precisely where the MVP needs speed. The memory concern is real but manageable with 4-6 agents -- Claude Code subprocesses themselves will dominate memory usage regardless of shell framework.

### 2.2 PTY Management

Each worktree needs at minimum 2 PTY sessions (Claude Code + Terminal), potentially more with split terminals. At 6 worktrees, that is 12+ PTY sessions.

```
PTY Resource Model:
┌─────────────────────────────────────────────┐
│ Worktree "feat/auth"                        │
│   PTY-1: Claude Code session (long-lived)   │
│   PTY-2: Terminal tab (user shell)          │
│   PTY-3: Terminal tab (split, optional)     │
├─────────────────────────────────────────────┤
│ Worktree "feat/dashboard"                   │
│   PTY-4: Claude Code session                │
│   PTY-5: Terminal tab                       │
├─────────────────────────────────────────────┤
│ ...x4-6 worktrees = 12-18 PTY instances    │
└─────────────────────────────────────────────┘
```

**Critical design decision needed:** PTY lifecycle management. Inactive worktree PTYs should be suspended (SIGSTOP) or output-buffered to avoid consuming CPU for scrollback processing. The spec does not address PTY lifecycle at all.

### 2.3 State Persistence: JSON vs SQLite

Referenced at `codrox.md:453`.

```
┌────────────────────┬─────────────────────────┬──────────────────────────┐
│ Criterion          │ JSON sidecar            │ SQLite                   │
├────────────────────┼─────────────────────────┼──────────────────────────┤
│ Simplicity         │ Trivial to implement    │ Needs better-sqlite3 or  │
│                    │                         │ sql.js binding           │
├────────────────────┼─────────────────────────┼──────────────────────────┤
│ Concurrent writes  │ DANGEROUS -- multiple   │ WAL mode handles this    │
│                    │ agents could corrupt    │ natively                 │
├────────────────────┼─────────────────────────┼──────────────────────────┤
│ Query capability   │ Must load entire file   │ Can query specific       │
│                    │ to filter/search        │ phase, agent, status     │
├────────────────────┼─────────────────────────┼──────────────────────────┤
│ Schema evolution   │ No schema enforcement   │ Migrations, typed cols   │
├────────────────────┼─────────────────────────┼──────────────────────────┤
│ Git friendliness   │ Can commit state with   │ Binary -- cannot be      │
│                    │ worktree (nice for      │ committed meaningfully   │
│                    │ debugging)              │                          │
├────────────────────┼─────────────────────────┼──────────────────────────┤
│ Crash recovery     │ Partial writes = corrupt│ ACID transactions        │
├────────────────────┼─────────────────────────┼──────────────────────────┤
│ Fit for this app   │ OK for Phase 1 MVP     │ Required by Phase 2+     │
└────────────────────┴─────────────────────────┴──────────────────────────┘
```

**RECOMMENDATION: Hybrid approach.**
- Per-worktree lifecycle state: JSON sidecar file (`.forge/lifecycle.json` in each worktree). Simple, portable, git-committable for debugging. Write-once-per-phase-transition means low write contention.
- Global app state (agent registry, workspace config, session history): SQLite in the app data directory. Multiple agents updating status concurrently demands ACID.
- Plan/task data: SQLite. Tasks get updated frequently during Implement phase and need relational queries (filter by status, reorder).

---

## 3. Scalability Concerns

### Memory Budget Analysis (4-6 parallel agents)

```
Component                    Per-Instance    x6 Agents    Notes
─────────────────────────────────────────────────────────────────
Electron shell               ~200 MB         ~200 MB      Shared (1 instance)
Renderer (React/Svelte)      ~100 MB         ~100 MB      Shared (1 instance)
Claude Code subprocess        ~80-150 MB     ~480-900 MB  DOMINANT COST
node-pty (Claude session)     ~5-10 MB       ~30-60 MB    Scrollback buffer
node-pty (Terminal)           ~5-10 MB       ~30-60 MB    Scrollback buffer
File watcher (per worktree)   ~10-20 MB      ~60-120 MB   chokidar/fs.watch
Git status polling            ~5 MB          ~30 MB       Subprocess per poll
─────────────────────────────────────────────────────────────────
TOTAL ESTIMATE                               ~930-1470 MB
```

**Key insight:** Claude Code subprocesses dominate memory. The app shell is a rounding error by comparison. This means the Electron vs Tauri decision matters less for memory than the agent subprocess strategy.

**Recommendations for scalability:**
1. Implement a PTY pool with configurable max size (default: 4 active, 2 suspended)
2. Suspend inactive worktree PTYs -- keep scrollback in a ring buffer on disk, not in memory
3. Use a single file watcher multiplexed across worktrees (not per-worktree chokidar instances)
4. Lazy-load worktree file trees -- only populate when the worktree is active in the UI
5. Set Claude Code subprocess `--max-memory` flags if available, or monitor RSS and warn

### CPU Concerns

Claude Code is mostly I/O bound (waiting on API responses), so CPU is less of a concern than memory. However, PTY output parsing for 6 concurrent sessions can spike CPU if done naively. Use a requestAnimationFrame-throttled renderer for terminal output -- do not re-render on every PTY data event.

---

## 4. Component Boundaries -- Recommended Module Decomposition

```
forge-os/
├── src/
│   ├── main/                          # Electron main process
│   │   ├── app.ts                     # App lifecycle, window management
│   │   ├── ipc/                       # IPC handler registration
│   │   │   ├── worktree.ipc.ts        # Git worktree operations
│   │   │   ├── pty.ipc.ts             # PTY create/write/resize/destroy
│   │   │   ├── lifecycle.ipc.ts       # Phase transitions
│   │   │   ├── agent.ipc.ts           # Agent spawn/status/kill
│   │   │   └── filesystem.ipc.ts      # File read/write/watch
│   │   ├── services/                  # Main process services
│   │   │   ├── WorktreeManager.ts     # git worktree add/list/remove
│   │   │   ├── PTYManager.ts          # PTY pool, lifecycle, suspension
│   │   │   ├── AgentManager.ts        # Claude Code subprocess orchestration
│   │   │   ├── LifecycleEngine.ts     # State machine for phases
│   │   │   ├── FileWatcher.ts         # Unified file system watcher
│   │   │   └── PersistenceService.ts  # SQLite + JSON sidecar
│   │   └── git/                       # Git operations (shell out to git)
│   │       ├── worktree.ts
│   │       ├── status.ts
│   │       └── diff.ts
│   ├── renderer/                      # Electron renderer process
│   │   ├── App.tsx
│   │   ├── layout/
│   │   │   ├── WorktreeSidebar.tsx
│   │   │   ├── MainContent.tsx
│   │   │   ├── AgentPanel.tsx
│   │   │   └── PhaseTrack.tsx
│   │   ├── tabs/
│   │   │   ├── ClaudeTab.tsx          # xterm.js bound to Claude PTY
│   │   │   ├── TerminalTab.tsx        # xterm.js bound to shell PTY
│   │   │   ├── EditorTab.tsx          # CodeMirror 6 instance
│   │   │   └── WebTab.tsx             # webview tag
│   │   ├── phases/                    # Phase-specific UI
│   │   │   ├── ProposeForm.tsx
│   │   │   ├── GrillView.tsx
│   │   │   ├── ResearchView.tsx
│   │   │   ├── PlanView.tsx
│   │   │   ├── ImplementView.tsx
│   │   │   └── VerifyView.tsx
│   │   ├── store/                     # State management
│   │   │   ├── workspaceStore.ts
│   │   │   ├── worktreeStore.ts
│   │   │   ├── agentStore.ts
│   │   │   └── phaseStore.ts
│   │   └── hooks/                     # React hooks for IPC
│   │       ├── useWorktree.ts
│   │       ├── usePTY.ts
│   │       └── useAgent.ts
│   └── shared/                        # Shared types (main + renderer)
│       ├── types/
│       │   ├── worktree.ts
│       │   ├── agent.ts
│       │   ├── lifecycle.ts
│       │   └── ipc.ts
│       └── constants.ts
├── forge.db                           # SQLite (app data dir at runtime)
└── package.json
```

### Critical Seams

The most important architectural boundaries are:

1. **PTYManager <-> AgentManager**: PTYManager owns the raw PTY. AgentManager owns the semantic layer (is this Claude session in Implement phase? What task is it on?). AgentManager must not reach into PTY internals.

2. **LifecycleEngine <-> Renderer**: Phase transitions happen in main process (authoritative). Renderer requests transitions via IPC. LifecycleEngine validates exit conditions before advancing.

3. **AgentManager <-> LifecycleEngine**: When an agent completes all tasks, AgentManager signals LifecycleEngine to propose a phase transition. The human must still approve.

4. **WorktreeManager <-> everything else**: All file paths must be resolved through WorktreeManager. Hardcoded paths are a bug -- every service must ask "which worktree?" first.

---

## 5. State Management

### State Taxonomy

```
┌─────────────────┬───────────────────┬──────────────────┬─────────────────┐
│ State Domain    │ Owner             │ Persistence      │ Scope           │
├─────────────────┼───────────────────┼──────────────────┼─────────────────┤
│ App lifecycle   │ Electron main     │ None (transient)  │ Global          │
│ (window pos,    │                   │ or electron-store │                 │
│  panel sizes)   │                   │                  │                 │
├─────────────────┼───────────────────┼──────────────────┼─────────────────┤
│ Workspace       │ WorkspaceStore    │ SQLite           │ Per-repo        │
│ (repo path,     │ (renderer) +     │                  │                 │
│  worktree list) │ PersistenceService│                  │                 │
├─────────────────┼───────────────────┼──────────────────┼─────────────────┤
│ Worktree        │ WorktreeStore     │ JSON sidecar     │ Per-worktree    │
│ (phase, branch, │ (renderer) +     │ in worktree dir  │                 │
│  created_at)    │ LifecycleEngine   │                  │                 │
├─────────────────┼───────────────────┼──────────────────┼─────────────────┤
│ Agent runtime   │ AgentStore        │ SQLite (status   │ Per-worktree    │
│ (task, progress,│ (renderer) +     │  history) + RAM  │                 │
│  elapsed)       │ AgentManager      │ (live state)     │                 │
├─────────────────┼───────────────────┼──────────────────┼─────────────────┤
│ Phase data      │ PhaseStore        │ SQLite (plans,   │ Per-worktree    │
│ (proposal text, │ (renderer) +     │  findings, tasks)│ per-phase       │
│  grill scores,  │ LifecycleEngine   │                  │                 │
│  research, plan)│                   │                  │                 │
├─────────────────┼───────────────────┼──────────────────┼─────────────────┤
│ Tab state       │ TabStore          │ SQLite or JSON   │ Per-worktree    │
│ (open tabs,     │ (renderer)        │                  │                 │
│  active tab,    │                   │                  │                 │
│  editor scroll) │                   │                  │                 │
├─────────────────┼───────────────────┼──────────────────┼─────────────────┤
│ PTY buffers     │ PTYManager        │ Disk ring buffer │ Per-PTY         │
│ (scrollback)    │ (main)            │ for suspended    │                 │
└─────────────────┴───────────────────┴──────────────────┴─────────────────┘
```

### State Interaction Rules

1. **Single source of truth**: Main process is authoritative for worktree state, agent state, and phase state. Renderer holds a cached projection updated via IPC events.
2. **Optimistic updates**: Renderer can optimistically update UI (e.g., "advancing to Implement") but must roll back if main process rejects the transition.
3. **No renderer-to-renderer state sharing**: All cross-worktree state flows through main process. Two worktree views never directly communicate.
4. **Phase data is append-only**: Moving backward in the lifecycle does not delete phase data (`codrox.md:154` -- "jumping back does not erase work"). This means phase data must be versioned or append-only.

---

## 6. IPC / Communication Patterns

### Main Process <-> Renderer

```
PATTERN: Request-Response + Event Streaming

Renderer                          Main Process
   │                                   │
   │──── ipc:worktree:create ────────>│  Request-Response
   │<─── ipc:worktree:created ────────│  (one-shot)
   │                                   │
   │<─── ipc:agent:output ────────────│  Event Stream
   │<─── ipc:agent:output ────────────│  (continuous PTY data)
   │<─── ipc:agent:output ────────────│
   │                                   │
   │──── ipc:agent:input ─────────────>│  Command
   │                                   │  (user types in terminal)
   │                                   │
   │<─── ipc:agent:status ────────────│  Polling or Push
   │                                   │  (task progress updates)
```

**Recommended IPC protocol:**
- Use Electron's `contextBridge` + `ipcRenderer.invoke()` for request-response (worktree CRUD, phase transitions, file operations)
- Use `ipcMain.on` / `webContents.send` for streaming (PTY output, agent status updates)
- Type all IPC channels with a shared TypeScript interface in `shared/types/ipc.ts`
- Implement a channel multiplexer: one PTY output channel with a worktree ID discriminator, not N separate channels

### Agent Subprocess Communication

Claude Code runs as a subprocess. The spec at `codrox.md:395` mentions "Claude Code subprocess integration (PTY)". The communication model should be:

```
┌──────────────┐    stdin/stdout     ┌──────────────┐
│ AgentManager │◄──── PTY ──────────►│ Claude Code  │
│  (main proc) │     (node-pty)      │  subprocess  │
└──────┬───────┘                     └──────────────┘
       │
       │ Parse stdout for:
       │  - Task completion markers
       │  - Structured JSON output (tool calls)
       │  - Error signals
       │
       ▼
  AgentStore update → IPC push → Renderer
```

**Critical concern at `codrox.md:454`:** "How to detect task completion in Implement?" This is the hardest integration problem. Options:

| Approach | Reliability | Complexity | Recommended |
|----------|-------------|------------|-------------|
| Parse stdout for markers | Fragile -- Claude output format changes | Low | No |
| Claude MCP tool calls | Structured, reliable | Medium | Yes, if available |
| Wrap Claude with a harness that emits JSON events | Reliable, controllable | Medium-High | Yes (primary) |
| Poll filesystem for `.forge/task-status.json` | Decoupled, simple | Low | Yes (fallback) |

**RECOMMENDATION:** Build a thin harness around Claude Code that:
1. Injects system prompts instructing Claude to emit structured status updates
2. Parses PTY output for JSON blocks matching a known schema
3. Falls back to filesystem polling (Claude writes status to a known path)

---

## 7. Missing Architectural Decisions

These are decisions the spec does not address but that must be resolved before implementation:

### 7.1 Error Recovery and Crash Handling
- What happens when a Claude Code subprocess crashes mid-Implement?
- Can the agent resume from the last completed task, or must the phase restart?
- How is PTY state recovered after an app crash?
- **Recommendation:** Checkpoint task status to disk after each task completion. On restart, scan for incomplete worktrees and offer resume.

### 7.2 Claude Code Session Management
- How is the Claude Code binary located and invoked? (`claude` CLI? API direct?)
- How are API keys / authentication managed?
- What happens when a Claude session hits context window limits mid-Implement?
- **Recommendation:** Use `claude --session-id` for resumable sessions. Store session IDs per worktree in lifecycle state.

### 7.3 Conflict Resolution Between Worktrees
- Two worktrees might modify the same file on different branches. This is fine in git, but what happens during merge?
- The spec at `codrox.md:456` says "Probably not" to shared worktrees, but does not address cross-worktree conflicts at merge time.
- **Recommendation:** At Verify phase, run `git merge --no-commit --no-ff main` to detect conflicts before PR creation.

### 7.4 Security Model
- Claude Code subprocesses have full filesystem access. Are they sandboxed to their worktree?
- Can an agent in `feat/auth` read files from `feat/dashboard`'s worktree?
- Web tab (`codrox.md:309`) -- what is the webview security policy? Can it access localhost (needed for preview) but not the wider internet?
- **Recommendation:** Set `cwd` for each Claude subprocess to its worktree root. Use Electron's `webview` partition to isolate web tabs. Do NOT use `nodeIntegration: true` in webview.

### 7.5 Offline / Degraded Mode
- What happens when Claude API is unreachable? The entire Implement phase is blocked.
- **Recommendation:** Show clear degraded-mode indicator. Terminal tabs and editor tabs remain functional. Queue phase transitions for when connectivity returns.

### 7.6 Plugin / Extension Architecture
- The spec defines a closed system. No mention of extending tab types, adding new phases, or customizing the lifecycle.
- **Recommendation:** Not needed for MVP. But design the phase system as a registry (not hardcoded switch statements) so phases can be added later without rewiring.

### 7.7 Logging and Observability
- With 4-6 agents running concurrently, debugging production issues requires structured logging.
- **Recommendation:** Structured JSON logs per agent per worktree. Centralized log viewer as a hidden developer tab.

---

## 8. Recommended Tech Stack

```
┌──────────────────────┬──────────────────────────────────────────────┐
│ Layer                │ Recommendation                               │
├──────────────────────┼──────────────────────────────────────────────┤
│ App Shell            │ Electron 33+ (Chromium 130+)                 │
│ Language             │ TypeScript throughout (main + renderer)      │
│ Renderer Framework   │ React 19 + TanStack Router                  │
│ State Management     │ Zustand (lightweight, no boilerplate)        │
│ Terminal             │ xterm.js 5 + node-pty                        │
│ Code Editor          │ CodeMirror 6 (lighter than Monaco for embed) │
│ Persistence (global) │ better-sqlite3 (sync, fast, native)          │
│ Persistence (local)  │ JSON sidecar per worktree                    │
│ IPC Typing           │ electron-trpc or typed IPC wrappers          │
│ File Watching        │ @parcel/watcher (faster than chokidar)       │
│ Git Operations       │ simple-git (wraps CLI, avoids libgit2 FFI)   │
│ CSS                  │ Tailwind CSS 4 + shadcn/ui components        │
│ Build                │ electron-vite (Vite for both main + renderer)│
│ Testing              │ Vitest + Playwright (E2E for Electron)       │
│ Packaging            │ electron-builder                             │
└──────────────────────┴──────────────────────────────────────────────┘
```

**Rationale for key choices:**
- **Zustand over Redux/Jotai**: Minimal API surface, works well with IPC-driven updates, no provider wrappers needed.
- **CodeMirror 6 over Monaco**: Monaco brings the full VS Code editor engine (~5 MB, heavy). CodeMirror 6 is modular, lighter, and sufficient for a viewer/light-editor. The spec at `codrox.md:313-318` describes editor features (syntax highlighting, diff view, file tabs) that CodeMirror 6 handles well.
- **@parcel/watcher over chokidar**: 10x less memory, native implementation, better for watching multiple worktree roots.
- **electron-trpc**: Gives end-to-end type safety on IPC with minimal ceremony. Alternative: hand-rolled typed wrappers in `shared/types/ipc.ts`.

---

## 9. Architecture Risks

### Risk 1: PTY Output Parsing Fragility (HIGH)
- **Description:** The entire Implement and Verify phase depends on parsing Claude Code's stdout to extract task status, test results, and completion signals (`codrox.md:454`).
- **Impact:** If Claude changes output format, or emits unexpected content, the agent status display breaks silently.
- **Mitigation:** Design a multi-signal approach: PTY parsing as primary, filesystem polling as secondary, user-triggered manual advance as escape hatch. Never block the UI on PTY parsing alone.

### Risk 2: Memory Exhaustion with Parallel Agents (MEDIUM-HIGH)
- **Description:** 6 Claude Code subprocesses + 6+ PTY sessions + Electron = 1-1.5 GB minimum.
- **Impact:** On 8 GB machines, this leaves little headroom for the OS and other apps. Swapping kills performance.
- **Mitigation:** Implement agent limits with clear warnings (`codrox.md:344`). Add memory monitoring. Default to 3 active agents, not 6.

### Risk 3: Lifecycle State Machine Complexity (MEDIUM)
- **Description:** The spec allows forward and backward movement through 6 phases (`codrox.md:154`), with exit conditions per phase, per worktree, while agents may be running.
- **Impact:** State machine bugs are subtle. What happens if you retreat from Implement to Plan while an agent is running? Does the agent stop? What if it completes a task during the retreat?
- **Mitigation:** Use a formal state machine library (XState 5). Define explicit transition guards. An agent MUST be stopped before retreating from Implement.

### Risk 4: Worktree Proliferation (MEDIUM)
- **Description:** "Worktrees are cheap" (`codrox.md:472`). Users may create many and forget to clean up.
- **Impact:** Disk space (full repo clone per worktree), stale branches, orphaned PTY processes.
- **Mitigation:** Worktree dashboard with age indicators. Auto-archive worktrees inactive for N days. Show disk usage.

### Risk 5: Claude Context Window Exhaustion (MEDIUM)
- **Description:** The Research phase (`codrox.md:200-218`) has Claude read files, schema, middleware, PRs. The Implement phase feeds back the full plan plus file contents.
- **Impact:** Large codebases will exceed context windows, causing degraded Claude performance or errors.
- **Mitigation:** The spec acknowledges this at `codrox.md:459` ("configurable depth limit"). Implement aggressive context budgeting: summarize Research findings instead of passing raw files. Use Claude's project knowledge/caching if available.

### Risk 6: Coupling Between Phase UI and Claude Prompt Engineering (LOW-MEDIUM)
- **Description:** Each phase requires a different Claude system prompt (adversarial for Grill, investigative for Research, etc. -- `codrox.md:87-90`). These prompts are a core product differentiator but are also a maintenance burden.
- **Impact:** Prompt changes affect UX. Prompt engineering is not testable with unit tests.
- **Mitigation:** Store system prompts as versioned templates, not inline strings. Build a prompt testing harness that runs regression scenarios against recorded Claude outputs.

---

## 10. Summary of Recommendations (Prioritized)

| # | Recommendation | Effort | Impact | Phase |
|---|----------------|--------|--------|-------|
| 1 | Use Electron with node-pty for MVP | Low | Unblocks all | Phase 1 |
| 2 | Implement PTYManager as a pool with suspension | Medium | Prevents memory blow-up | Phase 1 |
| 3 | Use XState for lifecycle state machine | Medium | Prevents state bugs | Phase 1 |
| 4 | Hybrid persistence (JSON sidecar + SQLite) | Medium | Right tool per job | Phase 1 |
| 5 | Build typed IPC layer (electron-trpc) | Medium | Prevents IPC bugs at scale | Phase 1 |
| 6 | Separate Agent Panel and Phase Chat into tabs | Low | Fixes 260px space conflict | Phase 1 |
| 7 | Design Claude output harness for task detection | High | Core product requirement | Phase 2 |
| 8 | Add memory monitoring and agent limit enforcement | Medium | Production stability | Phase 2 |
| 9 | Pre-merge conflict detection at Verify phase | Low | Prevents merge surprises | Phase 3 |
| 10 | Prompt template versioning system | Medium | Maintainability | Phase 3 |

---

## References

- `codrox.md:40-61` -- Layout zone definition (three-column architecture)
- `codrox.md:78-90` -- Agent Panel and Phase Chat competing for right panel space
- `codrox.md:99-141` -- Worktree model and parallel execution description
- `codrox.md:150-154` -- Phase movement rules (forward/backward, no data erasure)
- `codrox.md:250-267` -- Implement phase live display requirements
- `codrox.md:309` -- Web tab (embedded webview requirement)
- `codrox.md:344` -- Agent limit recommendation (4-6 simultaneous)
- `codrox.md:388-399` -- Phase 1 MVP build plan items
- `codrox.md:452-459` -- Open questions (Electron/Tauri, persistence, task detection, context depth)
- `codrox.md:472` -- Design principle "Worktrees are cheap"
