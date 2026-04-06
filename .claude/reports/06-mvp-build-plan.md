# Forge OS -- MVP Build Plan (Phase 1)

**Planner:** Claude (Planner Agent)  
**Date:** 2026-04-05  
**Source Documents:** `codrox.md`, reports 01-05  
**Status:** Ready for execution

---

## Context

This plan covers Phase 1 (Core Shell MVP) of Forge OS -- an AI-native development environment built around parallel Claude Code agent orchestration via git worktrees. Phase 1 delivers a single-worktree experience: open a repo, talk to Claude, edit files, run terminal commands -- all in one window.

### Decisions Locked

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Electron | node-pty ecosystem, dev velocity, proven at scale (VS Code, Hyper) |
| Claude integration | Claude Code CLI via PTY | User has subscription, no API key needed; PTY gives full interactive control |
| Editor | CodeMirror 6 | Lightweight, multi-instance, modular; diff via `@codemirror/merge` |
| State management | Zustand | Minimal API, IPC-friendly, no provider wrappers |
| Terminal | xterm.js 5 + node-pty | Industry standard, battle-tested |
| Git operations | simple-git | Wraps CLI, typed, worktree support |
| Persistence | JSON sidecar (per-worktree) + SQLite (global) | Right tool per job; JSON for debugging, SQLite for concurrent writes |
| Build tooling | electron-vite + TypeScript + React 19 + Tailwind CSS 4 | Vite for both main + renderer; Tailwind for rapid UI |
| IPC | Typed IPC layer (electron-trpc or hand-rolled) | End-to-end type safety on IPC channels |
| CSS components | Tailwind CSS 4 + shadcn/ui | Rapid, consistent UI without a heavy component library |
| Testing | Vitest + Playwright | Unit via Vitest, E2E via Playwright for Electron |
| Packaging | electron-builder | Standard Electron packaging |
| File watching | @parcel/watcher | 10x less memory than chokidar, native implementation |

### Phase 1 Exit Criteria

> "You can open a repo, talk to Claude, edit files, run terminal commands -- all in one window."

Measurable sub-criteria:
1. App launches, renders three-zone layout (sidebar, main content, right panel)
2. User can select a directory and it becomes the active worktree
3. File tree renders the directory structure with collapsible folders
4. Claude Code session starts via PTY and user can interact with it in a tab
5. Terminal tab provides full interactive bash scoped to the worktree directory
6. Editor tab opens files with syntax highlighting for JS/TS/Python/Rust minimum
7. State survives app restart (last opened worktree, open tabs)

### Design for N from Day 1

Per the verifier's critical finding (report 04), Phase 1 must include abstractions that Phase 2 requires:
- **PTYManager** as a pool abstraction (not a single PTY)
- **All Zustand stores scoped per-worktree** (not flat global state)
- **Tab state per-worktree** (not a single global tab manager)
- **IPC channels multiplexed with worktree ID discriminator**

---

## Architecture Reference

```
forge-os/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── src/
│   ├── main/                          # Electron main process
│   │   ├── index.ts                   # App lifecycle, window creation
│   │   ├── ipc/                       # IPC handler registration
│   │   │   ├── index.ts               # Register all handlers
│   │   │   ├── pty.ipc.ts             # PTY create/write/resize/destroy
│   │   │   ├── filesystem.ipc.ts      # File read/write/watch/tree
│   │   │   ├── git.ipc.ts             # Git status, diff operations
│   │   │   └── workspace.ipc.ts       # Open directory, workspace state
│   │   ├── services/
│   │   │   ├── PTYManager.ts          # PTY pool: create/write/resize/destroy/suspend
│   │   │   ├── FileWatcher.ts         # @parcel/watcher unified watcher
│   │   │   ├── GitService.ts          # simple-git wrapper for status/diff
│   │   │   └── PersistenceService.ts  # SQLite (global) + JSON sidecar helpers
│   │   └── lib/
│   │       └── ipc-types.ts           # Re-export shared IPC types for main
│   ├── renderer/                      # Electron renderer process (React)
│   │   ├── index.html
│   │   ├── main.tsx                   # React root + providers
│   │   ├── App.tsx                    # Three-zone layout shell
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx            # Left panel: worktree info + file tree + git changes
│   │   │   ├── MainContent.tsx        # Center: phase track + tab bar + tab content
│   │   │   └── RightPanel.tsx         # Right: agent panel placeholder + info
│   │   ├── components/
│   │   │   ├── FileTree.tsx           # Recursive directory tree with git annotations
│   │   │   ├── GitChanges.tsx         # Changed files list with M/A/D badges
│   │   │   ├── TabBar.tsx             # Tab strip with type badges
│   │   │   ├── CommandPalette.tsx     # Cmd+K palette (basic)
│   │   │   └── DirectoryPicker.tsx    # Open directory dialog
│   │   ├── tabs/
│   │   │   ├── ClaudeTab.tsx          # xterm.js bound to Claude Code PTY
│   │   │   ├── TerminalTab.tsx        # xterm.js bound to shell PTY
│   │   │   └── EditorTab.tsx          # CodeMirror 6 with syntax + diff
│   │   ├── store/
│   │   │   ├── workspaceStore.ts      # Active worktree path, workspace config
│   │   │   ├── tabStore.ts            # Open tabs, active tab (per-worktree keyed)
│   │   │   ├── fileTreeStore.ts       # Directory listing, expanded state
│   │   │   └── gitStore.ts            # Git status, changed files
│   │   ├── hooks/
│   │   │   ├── usePTY.ts             # Hook to connect xterm.js <-> PTY via IPC
│   │   │   ├── useFileTree.ts         # Hook to load/watch directory tree
│   │   │   └── useGitStatus.ts        # Hook to poll/watch git status
│   │   └── lib/
│   │       ├── ipc.ts                 # Typed IPC client (invoke + listen)
│   │       └── constants.ts           # Layout dimensions, defaults
│   ├── shared/                        # Shared between main + renderer
│   │   └── types/
│   │       ├── ipc.ts                 # IPC channel names + payload types
│   │       ├── workspace.ts           # Worktree, workspace types
│   │       ├── tabs.ts                # Tab types, tab state
│   │       ├── filesystem.ts          # File tree node, file entry types
│   │       └── git.ts                 # Git status, diff types
│   └── preload/
│       └── index.ts                   # contextBridge exposing typed IPC
├── resources/                         # App icons, native resources
└── tailwind.config.ts
```

---

## Task Breakdown

Tasks are grouped into **Batches**. Tasks within a batch can execute in parallel. Batches must execute in order (each batch depends on the previous).

---

### Batch 0: Project Scaffolding

> **Goal:** Buildable Electron + React + TypeScript project with dev tooling. Zero custom code -- just the skeleton.

#### Task 0.1 -- Initialize electron-vite project

**Agent scope:** Single agent  
**Inputs:** None (greenfield)  
**Outputs:** Working `npm run dev` that opens a blank Electron window

**Steps:**
1. Initialize project with `npm create @electron-vite` (or manual setup with electron-vite)
2. Configure `electron.vite.config.ts` for main + preload + renderer
3. Set up TypeScript configs: `tsconfig.json` (base), `tsconfig.node.json` (main/preload), `tsconfig.web.json` (renderer)
4. Install core dependencies:
   - `electron`, `electron-vite`, `electron-builder`
   - `react`, `react-dom`, `@types/react`, `@types/react-dom`
   - `typescript`
   - `tailwindcss@4`, `@tailwindcss/vite`
   - `vitest`, `@playwright/test`
5. Configure Tailwind CSS 4 (CSS-first config, `@import "tailwindcss"` in main CSS)
6. Set up basic `src/main/index.ts` with BrowserWindow creation
7. Set up `src/preload/index.ts` with empty contextBridge
8. Set up `src/renderer/index.html` + `src/renderer/main.tsx` with React root
9. Verify `npm run dev` opens a window with "Hello Forge OS"

**Acceptance criteria:**
- `npm run dev` launches Electron window with React rendering
- `npm run build` produces a distributable
- TypeScript compilation has zero errors
- Tailwind utility classes work in renderer

**Files created:**
```
package.json
electron.vite.config.ts
tsconfig.json, tsconfig.node.json, tsconfig.web.json
src/main/index.ts
src/preload/index.ts
src/renderer/index.html
src/renderer/main.tsx
src/renderer/assets/main.css
tailwind.config.ts (if needed for v4)
```

---

### Batch 1: Foundation Layer (3 parallel tasks)

> **Goal:** Typed IPC, shared types, and persistence -- the foundation everything else builds on.

#### Task 1.1 -- Shared type definitions

**Agent scope:** Single agent  
**Inputs:** Architecture reference above  
**Outputs:** All shared TypeScript types used across main + renderer

**Steps:**
1. Define IPC channel names and payload types in `src/shared/types/ipc.ts`
   - Request-response channels: `workspace:open`, `workspace:getState`, `fs:readDir`, `fs:readFile`, `fs:writeFile`, `git:status`, `git:diff`
   - Streaming channels: `pty:output`, `fs:changed`
   - Command channels: `pty:create`, `pty:write`, `pty:resize`, `pty:destroy`
2. Define workspace/worktree types in `src/shared/types/workspace.ts`
   - `Workspace { id, path, name, lastOpened }`
   - `WorktreeState { worktreeId, path, openTabs, activeTabId }`
3. Define tab types in `src/shared/types/tabs.ts`
   - `TabType = 'claude' | 'terminal' | 'editor'`
   - `Tab { id, type, title, worktreeId, metadata }` where metadata varies by type
   - `EditorTabMeta { filePath, isDirty, scrollPos }`
   - `TerminalTabMeta { ptyId }`
   - `ClaudeTabMeta { ptyId, sessionLabel }`
4. Define filesystem types in `src/shared/types/filesystem.ts`
   - `FileTreeNode { name, path, type: 'file' | 'directory', children?, gitStatus? }`
5. Define git types in `src/shared/types/git.ts`
   - `GitFileStatus { path, status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' }`
   - `GitDiff { filePath, hunks: DiffHunk[] }`

**Acceptance criteria:**
- All types compile with strict TypeScript
- Types are importable from both main and renderer via path aliases
- No runtime code -- pure type definitions + enums/constants

**Files created:**
```
src/shared/types/ipc.ts
src/shared/types/workspace.ts
src/shared/types/tabs.ts
src/shared/types/filesystem.ts
src/shared/types/git.ts
```

---

#### Task 1.2 -- Typed IPC layer (preload + main + renderer)

**Agent scope:** Single agent  
**Inputs:** Task 1.1 types  
**Outputs:** End-to-end typed IPC: renderer can `invoke()` and `listen()` with full type safety

**Steps:**
1. Implement `src/preload/index.ts`:
   - Use `contextBridge.exposeInMainWorld` to expose an `api` object
   - `api.invoke(channel, ...args)` -- wraps `ipcRenderer.invoke`
   - `api.on(channel, callback)` -- wraps `ipcRenderer.on`, returns unsubscribe function
   - `api.send(channel, ...args)` -- wraps `ipcRenderer.send` for fire-and-forget
2. Implement `src/renderer/lib/ipc.ts`:
   - Typed wrapper around `window.api` with generics keyed to channel names
   - `ipc.invoke<Channel>(channel, payload): Promise<ResponseType>`
   - `ipc.on<Channel>(channel, callback): () => void` (unsubscribe)
3. Implement `src/main/ipc/index.ts`:
   - Registration function that takes a BrowserWindow and registers all IPC handlers
   - Each handler module exports a `register(ipcMain, window)` function
   - Placeholder handler files for: `pty.ipc.ts`, `filesystem.ipc.ts`, `git.ipc.ts`, `workspace.ipc.ts`
4. Ensure the main process `index.ts` calls `registerAllHandlers(mainWindow)` after window creation

**Acceptance criteria:**
- TypeScript errors if you call `ipc.invoke` with wrong channel name or payload type
- A simple round-trip test: renderer invokes `workspace:getState`, main returns mock data, renderer receives it typed
- Streaming works: main can `webContents.send` and renderer receives via `ipc.on`

**Files created:**
```
src/preload/index.ts (overwrite scaffold)
src/renderer/lib/ipc.ts
src/main/ipc/index.ts
src/main/ipc/pty.ipc.ts (placeholder)
src/main/ipc/filesystem.ipc.ts (placeholder)
src/main/ipc/git.ipc.ts (placeholder)
src/main/ipc/workspace.ipc.ts (placeholder)
```

---

#### Task 1.3 -- Persistence service + Zustand store scaffolding

**Agent scope:** Single agent  
**Inputs:** Task 1.1 types  
**Outputs:** SQLite global database + JSON sidecar helpers + Zustand stores with per-worktree scoping

**Steps:**
1. Install `better-sqlite3` + `@types/better-sqlite3`
2. Implement `src/main/services/PersistenceService.ts`:
   - Initialize SQLite database in Electron `app.getPath('userData')/forge.db`
   - Create tables on first run: `workspaces(id, path, name, last_opened)`, `app_state(key, value_json)`
   - Methods: `getWorkspaces()`, `saveWorkspace()`, `getAppState(key)`, `setAppState(key, value)`
   - JSON sidecar helpers: `readWorktreeState(worktreePath)`, `writeWorktreeState(worktreePath, state)` -- reads/writes `.forge/state.json` inside the worktree directory
3. Implement Zustand stores in renderer:
   - `src/renderer/store/workspaceStore.ts`:
     - State: `{ activeWorktreePath: string | null, recentWorkspaces: Workspace[] }`
     - Actions: `openWorkspace(path)`, `setActiveWorktree(path)`
     - All state keyed so Phase 2 can add multi-worktree without refactor
   - `src/renderer/store/tabStore.ts`:
     - State: `{ tabsByWorktree: Record<string, Tab[]>, activeTabByWorktree: Record<string, string> }`
     - Actions: `openTab(worktreeId, tab)`, `closeTab(worktreeId, tabId)`, `setActiveTab(worktreeId, tabId)`
     - Per-worktree scoping from day 1
   - `src/renderer/store/fileTreeStore.ts`:
     - State: `{ nodesByWorktree: Record<string, FileTreeNode>, expandedPaths: Set<string> }`
     - Actions: `setTree(worktreeId, root)`, `toggleExpand(path)`
   - `src/renderer/store/gitStore.ts`:
     - State: `{ statusByWorktree: Record<string, GitFileStatus[]> }`
     - Actions: `setStatus(worktreeId, statuses)`
4. Wire workspace IPC handler (`workspace.ipc.ts`) to PersistenceService:
   - `workspace:open` -- validates path, saves to SQLite, returns workspace
   - `workspace:getState` -- returns current app state
   - `workspace:getRecent` -- returns recent workspaces list

**Acceptance criteria:**
- SQLite database created on first launch at correct location
- `better-sqlite3` works inside Electron main process (native module compilation)
- Zustand stores are importable and reactive in React components
- All stores use per-worktree keying (no flat global state)
- JSON sidecar writes to `.forge/state.json` inside a test directory

**Files created:**
```
src/main/services/PersistenceService.ts
src/renderer/store/workspaceStore.ts
src/renderer/store/tabStore.ts
src/renderer/store/fileTreeStore.ts
src/renderer/store/gitStore.ts
```

---

### Batch 2: Core Services (2 parallel tasks)

> **Goal:** PTY management and filesystem/git services in the main process.

#### Task 2.1 -- PTYManager service

**Agent scope:** Single agent  
**Inputs:** Task 1.2 IPC layer  
**Outputs:** PTY pool in main process; IPC handlers for create/write/resize/destroy

**Steps:**
1. Install `node-pty`
2. Implement `src/main/services/PTYManager.ts`:
   - `Map<string, { pty: IPty, worktreeId: string, type: 'claude' | 'terminal' }>` -- session registry
   - `create(id: string, options: { cwd: string, shell?: string, args?: string[], env?: Record<string,string> }): void`
     - Spawns `node-pty.spawn(shell, args, { cwd, env, cols: 80, rows: 24 })`
     - Registers `onData` listener that forwards to renderer via IPC stream
     - Registers `onExit` listener for cleanup
   - `write(id: string, data: string): void`
   - `resize(id: string, cols: number, rows: number): void`
   - `destroy(id: string): void` -- kills process, removes from registry
   - `destroyByWorktree(worktreeId: string): void` -- kills all PTYs for a worktree (Phase 2 ready)
   - `getActiveCount(): number`
3. Wire IPC handlers in `src/main/ipc/pty.ipc.ts`:
   - `pty:create` -- calls `PTYManager.create()`, streams output via `webContents.send('pty:output', { id, data })`
   - `pty:write` -- calls `PTYManager.write()`
   - `pty:resize` -- calls `PTYManager.resize()`
   - `pty:destroy` -- calls `PTYManager.destroy()`
4. Handle PTY exit events -- notify renderer that session ended

**Acceptance criteria:**
- Can spawn a bash shell PTY, send `echo hello\n`, and receive `hello` back via IPC
- Can spawn a `claude` CLI PTY (if Claude Code is installed) and see its output
- PTY resize updates terminal dimensions correctly
- Destroying a PTY kills the underlying process
- Multiple concurrent PTYs work without cross-talk (IPC messages routed by ID)

**Files created:**
```
src/main/services/PTYManager.ts
src/main/ipc/pty.ipc.ts (overwrite placeholder)
```

---

#### Task 2.2 -- Filesystem service + Git service

**Agent scope:** Single agent  
**Inputs:** Task 1.2 IPC layer  
**Outputs:** File tree reading, file read/write, file watching, git status + diff

**Steps:**
1. Install `simple-git`, `@parcel/watcher`
2. Implement `src/main/services/FileWatcher.ts`:
   - Uses `@parcel/watcher` to watch a directory recursively
   - Emits change events via IPC: `fs:changed { worktreeId, events: [{ type, path }] }`
   - Methods: `watch(worktreeId, dirPath)`, `unwatch(worktreeId)`
   - Debounces events (100ms) to avoid flooding
3. Implement `src/main/services/GitService.ts`:
   - Uses `simple-git` initialized to a worktree path
   - `getStatus(worktreePath): Promise<GitFileStatus[]>` -- returns modified/added/deleted/untracked files
   - `getDiff(worktreePath, filePath): Promise<string>` -- returns unified diff for a file
   - `getLog(worktreePath, limit): Promise<GitLogEntry[]>` -- recent commits
4. Wire IPC handlers in `src/main/ipc/filesystem.ipc.ts`:
   - `fs:readDir` -- reads directory recursively (respects `.gitignore`, skips `node_modules`, `.git`)
   - `fs:readFile` -- reads file content as string
   - `fs:writeFile` -- writes file content
   - `fs:watch` -- starts watcher for a directory
   - `fs:unwatch` -- stops watcher
5. Wire IPC handlers in `src/main/ipc/git.ipc.ts`:
   - `git:status` -- calls `GitService.getStatus()`
   - `git:diff` -- calls `GitService.getDiff()`

**Acceptance criteria:**
- `fs:readDir` returns a tree of `FileTreeNode` objects for a real directory, skipping `.git` and `node_modules`
- `fs:readFile` returns file contents; `fs:writeFile` writes and confirms
- File watcher detects new/modified/deleted files and sends events to renderer
- `git:status` returns correct statuses for a git repo with changes
- `git:diff` returns a valid unified diff string

**Files created:**
```
src/main/services/FileWatcher.ts
src/main/services/GitService.ts
src/main/ipc/filesystem.ipc.ts (overwrite placeholder)
src/main/ipc/git.ipc.ts (overwrite placeholder)
```

---

### Batch 3: Layout Shell (1 task)

> **Goal:** Three-zone layout rendered in the window, wired to stores, with working directory picker.

#### Task 3.1 -- Application layout + directory picker

**Agent scope:** Single agent  
**Inputs:** Tasks 1.2, 1.3 (IPC + stores)  
**Outputs:** Rendered three-zone layout; user can open a directory that becomes the active worktree

**Steps:**
1. Implement `src/renderer/App.tsx`:
   - Three-zone flexbox layout: sidebar (220px min) | main (flex-1) | right panel (260px min)
   - Panels should be resizable via drag handles (use a simple CSS resize or a lightweight splitter)
   - If no workspace is open, show a welcome screen with "Open Directory" button
2. Implement `src/renderer/layout/Sidebar.tsx`:
   - Top section: worktree name + branch (placeholder for Phase 2 worktree list)
   - Middle section: slot for FileTree component
   - Bottom section: slot for GitChanges component
   - Scrollable overflow
3. Implement `src/renderer/layout/MainContent.tsx`:
   - Top: tab bar (slot for TabBar component)
   - Content area: renders active tab content
   - Reads from `tabStore` for the active worktree
4. Implement `src/renderer/layout/RightPanel.tsx`:
   - Placeholder for agent panel (Phase 2)
   - For MVP: shows workspace info (path, git branch, file count)
5. Implement `src/renderer/components/DirectoryPicker.tsx`:
   - Button that triggers Electron's `dialog.showOpenDialog({ properties: ['openDirectory'] })` via IPC
   - On selection: calls `workspaceStore.openWorkspace(path)` which invokes `workspace:open` IPC
   - Workspace store updates, triggers file tree load and git status load
6. Implement `src/renderer/lib/constants.ts`:
   - Layout dimensions, default values, breakpoints
7. Set up dark theme as default via Tailwind (dark background, light text -- standard dev tool palette)

**Acceptance criteria:**
- App renders three columns with correct proportions
- "Open Directory" dialog works and persists the selection
- On reopening the app, the last workspace is restored
- Layout does not break at 1280x720 minimum window size
- Sidebar, main content, and right panel are visually distinct

**Files created:**
```
src/renderer/App.tsx (overwrite scaffold)
src/renderer/layout/Sidebar.tsx
src/renderer/layout/MainContent.tsx
src/renderer/layout/RightPanel.tsx
src/renderer/components/DirectoryPicker.tsx
src/renderer/lib/constants.ts
```

---

### Batch 4: UI Components (3 parallel tasks)

> **Goal:** File tree, git changes panel, and tab system -- the three interactive pieces of the shell.

#### Task 4.1 -- File tree component

**Agent scope:** Single agent  
**Inputs:** Tasks 2.2 (filesystem IPC), 1.3 (fileTreeStore)  
**Outputs:** Interactive file tree in the sidebar

**Steps:**
1. Implement `src/renderer/hooks/useFileTree.ts`:
   - On workspace open: invokes `fs:readDir` to get initial tree
   - Subscribes to `fs:changed` events to refresh affected subtrees
   - Updates `fileTreeStore`
2. Implement `src/renderer/components/FileTree.tsx`:
   - Recursive tree rendering from `FileTreeNode`
   - Collapsible directories (click to toggle)
   - File icons by extension (use a simple mapping, no icon library needed)
   - Git status indicators: `●` modified (amber), `+` added (green), `?` untracked (grey)
   - Click file: dispatches `tabStore.openTab` with an editor tab for that file
   - Keyboard navigation: arrow keys to move, Enter to open/toggle
3. Performance: virtualize the list for repos with 1000+ visible nodes (use a lightweight virtualizer or windowing)

**Acceptance criteria:**
- Renders a real project directory tree correctly
- Directories collapse/expand on click
- Git status annotations appear on modified/added files
- Clicking a file opens an editor tab (even if EditorTab is not yet built -- the tab entry appears in the tab bar)
- Tree refreshes when files change on disk

**Files created:**
```
src/renderer/hooks/useFileTree.ts
src/renderer/components/FileTree.tsx
```

---

#### Task 4.2 -- Git changes panel

**Agent scope:** Single agent  
**Inputs:** Tasks 2.2 (git IPC), 1.3 (gitStore)  
**Outputs:** Compact list of changed files in the sidebar

**Steps:**
1. Implement `src/renderer/hooks/useGitStatus.ts`:
   - On workspace open: invokes `git:status`
   - Re-polls on `fs:changed` events (debounced to 2 seconds)
   - Updates `gitStore`
2. Implement `src/renderer/components/GitChanges.tsx`:
   - Lists changed files from `gitStore`
   - Each entry: change type badge (`M` amber / `A` green / `D` red / `?` grey) + filename (truncated path)
   - Click opens editor tab in diff mode for that file
   - Empty state: "No changes" message
   - Count badge in section header: "Changes (5)"

**Acceptance criteria:**
- Shows correct list of changed files for a git repo
- Badges correctly indicate modification type
- Clicking a changed file opens an editor tab (diff mode metadata set)
- List updates within 3 seconds of a file change

**Files created:**
```
src/renderer/hooks/useGitStatus.ts
src/renderer/components/GitChanges.tsx
```

---

#### Task 4.3 -- Tab bar + tab system

**Agent scope:** Single agent  
**Inputs:** Task 1.3 (tabStore)  
**Outputs:** Tab bar component that renders tabs, switches between them, and closes them

**Steps:**
1. Implement `src/renderer/components/TabBar.tsx`:
   - Renders horizontal tab strip from `tabStore` for active worktree
   - Each tab shows: type badge (colored dot: amber=claude, green=terminal, purple=editor) + title
   - Active tab is visually highlighted
   - Click tab: `tabStore.setActiveTab()`
   - Close button (x) on each tab: `tabStore.closeTab()`
   - "+" button at end: opens new tab picker (dropdown: Claude, Terminal, Editor)
   - Tab overflow: horizontal scroll with fade indicators
2. Implement tab content routing in `MainContent.tsx`:
   - Based on active tab type, renders `<ClaudeTab>`, `<TerminalTab>`, or `<EditorTab>`
   - Passes tab metadata (ptyId, filePath, etc.) as props
   - Lazy mounting: only mount the active tab's heavy component; keep others in DOM but hidden (for terminal scroll preservation)
3. On workspace open, auto-create a default Claude tab and Terminal tab

**Acceptance criteria:**
- Tab bar renders with correct badges and titles
- Switching tabs shows the correct content area
- Closing a tab removes it; closing the last tab shows empty state
- "+" button creates new tabs of selected type
- Tabs survive worktree re-selection (per-worktree scoping)

**Files created:**
```
src/renderer/components/TabBar.tsx
(modifications to src/renderer/layout/MainContent.tsx)
```

---

### Batch 5: Tab Implementations (3 parallel tasks)

> **Goal:** The three tab types -- Claude, Terminal, Editor -- all functional.

#### Task 5.1 -- Terminal tab (xterm.js + node-pty)

**Agent scope:** Single agent  
**Inputs:** Task 2.1 (PTYManager), Task 1.2 (IPC)  
**Outputs:** Fully interactive terminal tab

**Steps:**
1. Install `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-webgl` (or `@xterm/addon-canvas`)
2. Implement `src/renderer/hooks/usePTY.ts`:
   - On mount: invokes `pty:create` with `{ cwd: worktreePath, shell: userShell }`
   - Subscribes to `pty:output` filtered by PTY ID
   - Returns: `{ write(data), resize(cols, rows), destroy(), ptyId }`
   - On unmount: does NOT destroy PTY (keeps it alive for tab switching); cleanup on tab close
3. Implement `src/renderer/tabs/TerminalTab.tsx`:
   - Creates xterm.js `Terminal` instance with WebGL renderer
   - Attaches `addon-fit` for automatic resize
   - Connects xterm `onData` -> `usePTY.write()`
   - Connects `usePTY` output -> `xterm.write()`
   - Handles container resize -> `fitAddon.fit()` -> `usePTY.resize()`
   - Theme: dark background matching app theme
4. Ensure terminal preserves scrollback when switching tabs (do not unmount xterm)

**Acceptance criteria:**
- Terminal opens with user's default shell at the worktree directory
- Full interactive bash works: `ls`, `cd`, `git status`, vim, etc.
- ANSI colors render correctly
- Terminal resizes when panel resizes
- Copy/paste works (Cmd+C/Cmd+V)
- Scrollback is preserved across tab switches

**Files created:**
```
src/renderer/hooks/usePTY.ts
src/renderer/tabs/TerminalTab.tsx
```

---

#### Task 5.2 -- Claude Code tab (xterm.js + Claude CLI PTY)

**Agent scope:** Single agent  
**Inputs:** Task 2.1 (PTYManager), Task 5.1 (shared usePTY hook)  
**Outputs:** Claude Code session running in a terminal tab

**Steps:**
1. Implement `src/renderer/tabs/ClaudeTab.tsx`:
   - Reuses the same xterm.js + usePTY pattern as TerminalTab
   - On mount: invokes `pty:create` with `{ cwd: worktreePath, shell: 'claude', args: [], type: 'claude' }`
   - The PTY spawns the `claude` CLI binary (resolved via `which claude` or configurable path)
   - User interacts with Claude Code natively through the terminal interface
   - Visual wrapper: same terminal but with an amber top border to distinguish from regular terminal
2. Add Claude binary path resolution in main process:
   - Check `PATH` for `claude` binary
   - Allow override via settings (stored in SQLite `app_state`)
   - Show helpful error if Claude Code is not installed
3. Handle Claude session end (process exits):
   - Show "Session ended" message in the terminal
   - Offer "Restart Session" button overlay

**Acceptance criteria:**
- Claude Code launches and is fully interactive
- User can chat with Claude, use slash commands, etc.
- Claude operates in the correct worktree directory
- Session restart works after Claude exits
- If Claude CLI is not found, a clear error message is shown

**Files created:**
```
src/renderer/tabs/ClaudeTab.tsx
(modifications to src/main/services/PTYManager.ts for Claude binary resolution)
```

---

#### Task 5.3 -- Editor tab (CodeMirror 6)

**Agent scope:** Single agent  
**Inputs:** Task 2.2 (filesystem IPC)  
**Outputs:** File editor with syntax highlighting and diff view

**Steps:**
1. Install CodeMirror 6 packages:
   - `@codemirror/view`, `@codemirror/state`, `@codemirror/commands`
   - `@codemirror/language` + language packages: `@codemirror/lang-javascript`, `@codemirror/lang-python`, `@codemirror/lang-rust`, `@codemirror/lang-json`, `@codemirror/lang-html`, `@codemirror/lang-css`, `@codemirror/lang-markdown`
   - `@codemirror/merge` (for diff view)
   - `@codemirror/theme-one-dark` (dark theme)
   - `@codemirror/search` (find/replace)
2. Implement `src/renderer/tabs/EditorTab.tsx`:
   - On mount: invokes `fs:readFile` for the file path from tab metadata
   - Creates CodeMirror `EditorView` with:
     - Language detection based on file extension
     - One Dark theme
     - Line numbers, bracket matching, code folding
     - Search (Cmd+F)
     - Read-write mode with Cmd+S to save (invokes `fs:writeFile`)
   - Diff mode (triggered from git changes panel):
     - Uses `@codemirror/merge` to show side-by-side or unified diff
     - Left side: original (from `git:diff`), right side: current
   - Tracks dirty state (unsaved changes) -- updates tab title with dot indicator
3. Implement language detection utility:
   - Map file extensions to CodeMirror language packages
   - Fallback to plain text for unknown extensions
4. Handle external file changes:
   - Listen for `fs:changed` events matching the open file
   - If file changed externally and editor is clean: reload silently
   - If file changed externally and editor is dirty: show notification "File changed on disk"

**Acceptance criteria:**
- Opens JS/TS/Python/Rust/JSON/HTML/CSS/Markdown files with correct syntax highlighting
- Cmd+S saves the file
- Diff view shows changes clearly with color coding
- Dirty state indicator appears on unsaved changes
- External file changes are detected and handled
- Editor performs well on files up to 10,000 lines

**Files created:**
```
src/renderer/tabs/EditorTab.tsx
```

---

### Batch 6: Integration + Command Palette (1 task)

> **Goal:** Wire everything together, add command palette, ensure the full flow works end-to-end.

#### Task 6.1 -- End-to-end integration + command palette

**Agent scope:** Single agent  
**Inputs:** All previous tasks  
**Outputs:** Complete working MVP

**Steps:**
1. Implement `src/renderer/components/CommandPalette.tsx`:
   - Triggered by `Cmd+K` (global keyboard listener)
   - Modal overlay with search input
   - Actions: "Open Directory", "New Terminal", "New Claude Session", "Open File" (with file search)
   - Fuzzy search over action names
   - Keyboard navigation: arrow keys + Enter
2. Wire the full startup flow:
   - App launches -> check for saved workspace in SQLite -> if found, auto-open it
   - Workspace opens -> start file watcher -> load file tree -> load git status
   - Auto-create default tabs (Claude + Terminal) -> PTYs spawn
   - User can interact with Claude, run terminal commands, click files to edit
3. Wire sidebar interactions:
   - Click file in FileTree -> opens EditorTab
   - Click changed file in GitChanges -> opens EditorTab in diff mode
4. Handle window lifecycle:
   - On close: save workspace state (open tabs, active tab, window size/position) to SQLite + JSON sidecar
   - On reopen: restore state
5. Add global keyboard shortcuts:
   - `Cmd+K` -- command palette
   - `Cmd+T` -- new terminal tab
   - `Cmd+N` -- new Claude session tab
   - `Cmd+W` -- close active tab (NOT "new worktree" -- respects macOS convention per critic review)
   - `Cmd+P` -- open file (quick open via command palette variant)
   - `Cmd+1/2/3...` -- switch to tab by position
6. Error boundaries:
   - React error boundary wrapping each tab (one tab crash does not kill the app)
   - PTY error handling: if spawn fails, show error in the tab area
   - IPC timeout handling: if main process does not respond in 10s, show error

**Acceptance criteria (the exit criteria):**
1. App launches, renders three-zone layout
2. User can open a directory via picker or command palette
3. File tree renders correctly with git annotations
4. Claude Code session works -- user can chat with Claude
5. Terminal tab provides full interactive bash
6. Editor opens files with syntax highlighting; Cmd+S saves
7. Diff view works from git changes panel
8. Command palette responds to Cmd+K with working actions
9. State survives app restart (last workspace, open tabs)
10. No crash during a 30-minute session with active Claude + terminal use

**Files created:**
```
src/renderer/components/CommandPalette.tsx
(modifications to App.tsx, MainContent.tsx, Sidebar.tsx for wiring)
```

---

### Batch 7: Testing + Polish (1 task)

> **Goal:** Automated test coverage for critical paths, visual polish, build verification.

#### Task 7.1 -- Tests + build verification

**Agent scope:** Single agent  
**Inputs:** All previous tasks  
**Outputs:** Test suite + verified build

**Steps:**
1. Unit tests (Vitest):
   - `PTYManager`: create, write, resize, destroy, destroyByWorktree
   - `PersistenceService`: SQLite CRUD, JSON sidecar read/write
   - `GitService`: status parsing, diff retrieval
   - Zustand stores: all actions produce correct state transitions
   - IPC type safety: compile-time checks for channel/payload mismatches
2. Integration tests:
   - File tree loads correctly for a test fixture directory
   - Git status returns correct results for a test repo
   - PTY round-trip: spawn, write, receive output, destroy
3. E2E test (Playwright):
   - Launch app -> open a test directory -> verify file tree renders
   - Open terminal tab -> type `echo test` -> verify output
   - Open file from tree -> verify editor renders with content
4. Build verification:
   - `npm run build` succeeds without errors
   - Built app launches on macOS
   - Native modules (node-pty, better-sqlite3) are correctly packaged
5. Visual polish pass:
   - Consistent spacing and typography across all panels
   - Loading states for: file tree loading, git status loading, PTY connecting
   - Empty states for: no workspace, no tabs, no git changes
   - Window minimum size enforced (1280x720)

**Acceptance criteria:**
- All unit tests pass
- All integration tests pass
- E2E test passes on a clean checkout
- `npm run build` produces a working macOS app
- No TypeScript errors in strict mode

**Files created:**
```
tests/unit/PTYManager.test.ts
tests/unit/PersistenceService.test.ts
tests/unit/GitService.test.ts
tests/unit/stores.test.ts
tests/integration/fileTree.test.ts
tests/integration/gitStatus.test.ts
tests/integration/pty.test.ts
tests/e2e/app.spec.ts
```

---

## Execution Summary

```
Batch 0: Project Scaffolding                    [1 task, sequential]
   └── Task 0.1: electron-vite init
       
Batch 1: Foundation Layer                       [3 tasks, PARALLEL]
   ├── Task 1.1: Shared types
   ├── Task 1.2: Typed IPC layer
   └── Task 1.3: Persistence + Zustand stores
       
Batch 2: Core Services                          [2 tasks, PARALLEL]
   ├── Task 2.1: PTYManager
   └── Task 2.2: Filesystem + Git services
       
Batch 3: Layout Shell                           [1 task, sequential]
   └── Task 3.1: Three-zone layout + directory picker
       
Batch 4: UI Components                          [3 tasks, PARALLEL]
   ├── Task 4.1: File tree
   ├── Task 4.2: Git changes panel
   └── Task 4.3: Tab bar + tab system
       
Batch 5: Tab Implementations                    [3 tasks, PARALLEL]
   ├── Task 5.1: Terminal tab
   ├── Task 5.2: Claude Code tab
   └── Task 5.3: Editor tab (CodeMirror 6)
       
Batch 6: Integration                            [1 task, sequential]
   └── Task 6.1: End-to-end wiring + command palette
       
Batch 7: Testing + Polish                       [1 task, sequential]
   └── Task 7.1: Tests + build verification

Total: 15 tasks across 8 batches
Max parallelism: 3 agents
```

---

## Dependency Graph

```
0.1 ─┬─> 1.1 ─┬─> 2.1 ──┐
     │        │          │
     ├─> 1.2 ─┤─> 2.2 ──┤
     │        │          │
     └─> 1.3 ─┘         ├─> 3.1 ─┬─> 4.1 ──┐
                         │        │          │
                         │        ├─> 4.2 ──┤
                         │        │          │
                         │        └─> 4.3 ──┤
                         │                   │
                         ├───────────────────┤
                         │                   │
                         │        ┌─> 5.1 ──┤
                         │        │          │
                         └────────┤─> 5.2 ──┤
                                  │          │
                                  └─> 5.3 ──┤
                                             │
                                             ├─> 6.1 ─> 7.1
```

---

## Risk Mitigations Built Into This Plan

| Risk (from reports) | Mitigation in this plan |
|---------------------|------------------------|
| Phase 1 PTY not designed for N sessions | PTYManager is a pool with `destroyByWorktree()` from day 1 (Task 2.1) |
| Flat global state blocks Phase 2 | All Zustand stores use per-worktree keying (Task 1.3) |
| Tab state not scoped per-worktree | `tabStore` uses `tabsByWorktree: Record<string, Tab[]>` (Task 1.3) |
| IPC channel explosion | Single `pty:output` channel with ID discriminator (Task 1.2) |
| node-pty native module build failures | Validated in Task 0.1 scaffolding + Task 7.1 build test |
| better-sqlite3 native module issues | Validated in Task 1.3 + Task 7.1 build test |
| Cmd+W conflict with macOS "Close Tab" | Remapped per critic review: Cmd+W = close tab (Task 6.1) |
| No error boundaries | React error boundary per tab + IPC timeouts (Task 6.1) |
| State lost on app crash | Workspace state saved to SQLite + JSON sidecar on close (Task 6.1) |

---

## What This Plan Does NOT Cover (Deferred to Phase 2+)

- Multi-worktree support (sidebar worktree list, worktree creation)
- Agent panel with live status cards
- Feature lifecycle state machine (6 phases)
- Phase-specific Claude system prompts
- Structured Claude output parsing
- Grill scoring, Research findings, Plan tasks, Verify checklist
- Web tab (embedded webview)
- PR creation
- Auto-update mechanism
- Cross-platform support (macOS-first)

---

## Notes for Executors

1. **Native modules (node-pty, better-sqlite3):** These require Electron's `electron-rebuild` or `electron-vite`'s native module support. Validate early in Task 0.1 by importing both in the main process. If they fail, this is a blocker -- do not proceed until resolved.

2. **Claude CLI path:** The `claude` binary must be in the user's PATH. Task 5.2 should resolve this with `which claude` in the main process. If not found, show a first-run dialog explaining how to install Claude Code.

3. **xterm.js WebGL renderer:** Falls back to canvas if WebGL is unavailable. Use `@xterm/addon-webgl` as primary, `@xterm/addon-canvas` as fallback.

4. **electron-vite path aliases:** Configure `resolve.alias` in `electron.vite.config.ts` so `@shared/` maps to `src/shared/`, `@main/` to `src/main/`, `@renderer/` to `src/renderer/`. This keeps imports clean.

5. **Tailwind CSS 4:** Uses the new CSS-first configuration (`@import "tailwindcss"`). No `tailwind.config.js` needed if using default config. For custom theme (dark mode colors), use `@theme` directive in CSS.

6. **Per-worktree scoping pattern:** Every store that holds worktree-specific data should use this pattern:
   ```typescript
   interface TabStoreState {
     tabsByWorktree: Record<string, Tab[]>;  // keyed by worktree path
     activeTabByWorktree: Record<string, string>;
   }
   ```
   This avoids the Phase 1 -> Phase 2 refactor the verifier warned about.
