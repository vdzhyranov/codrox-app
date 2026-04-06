# 07 — tmux Integration Architecture Plan

**Date:** 2026-04-05
**Scope:** Replace the xterm.js + node-pty pane system with real tmux integration
**Complexity:** HIGH — touches main process services, IPC layer, renderer components, and store

---

## 1. Architectural Decision: Option C (tmux in a single PTY)

### Decision

**Spawn tmux inside a single node-pty, render it in one full-size xterm.js instance. The app sends tmux commands via `child_process.execSync`/`execFile` to control pane layout programmatically.**

### Why Option C over A and B

| Criteria | Option A (attach session) | Option B (control mode `-CC`) | Option C (tmux in PTY) |
|---|---|---|---|
| Visual fidelity | tmux draws its own chrome inside xterm — status bar, borders visible | App must re-implement all tmux rendering in React from parsed control sequences | tmux draws everything natively — zero rendering gap |
| Implementation complexity | Medium — must hide tmux UI or accept it | Very High — must parse `%begin`/`%end`/`%output` protocol, build layout engine | Low — tmux is the UI, app just sends commands |
| Resize handling | tmux handles it | App must relay sizes to tmux via control protocol | tmux + xterm FitAddon handle it automatically |
| User familiarity | Users see tmux but can't interact naturally | Custom UI, not tmux | Full tmux experience — users can use tmux keybindings directly |
| Sub-agent panes | `tmux split-window` via shell | `tmux split-window` via control channel | `tmux split-window` via shell — same |
| Session persistence | tmux sessions survive app restart | Same | Same |
| Dependency on tmux internals | Low | High (control mode protocol is poorly documented) | Low |

**Option B was invalidated** because: the tmux control mode (`-CC`) protocol is underdocumented, primarily designed for iTerm2's proprietary integration, and would require building a complete terminal multiplexer renderer in React — effectively recreating the very complexity we are trying to eliminate. It also introduces a fragile coupling to tmux's internal protocol that can break across tmux versions.

**Option A was invalidated** because: it is functionally identical to Option C but with less clarity. "Attaching" to a tmux session via node-pty IS spawning tmux in a PTY. Option A as described in the brief is Option C with extra steps.

### Consequences

- Users see tmux borders, status bar, and pane numbering natively
- Users can use tmux keybindings (Ctrl-b + %, Ctrl-b + ", etc.) directly
- The app's React pane tree (`PaneRenderer.tsx`, `PaneSplit`, `PaneLeaf`) is deleted entirely
- The tab system is repurposed: each "tab" maps to a tmux session (one per worktree)
- The app loses fine-grained React control over individual pane contents (acceptable tradeoff)
- tmux must be installed on the user's machine

---

## 2. Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  Renderer Process                                        │
│                                                          │
│  ┌──────────────────────────────────────────────┐       │
│  │  Single xterm.js instance (full main area)    │       │
│  │  - Receives ALL output from the tmux PTY      │       │
│  │  - Sends ALL keystrokes to the tmux PTY       │       │
│  │  - FitAddon keeps dimensions synced           │       │
│  └──────────────┬───────────────────▲────────────┘       │
│                 │ IPC               │ IPC                 │
│  ┌──────────────▼───────────────────┴────────────┐       │
│  │  TmuxSessionBar (new component)                │       │
│  │  - Shows active tmux sessions (one per wt)     │       │
│  │  - Buttons: split-h, split-v, new-pane, kill   │       │
│  │  - Calls tmux:command via IPC                  │       │
│  └──────────────────────────────────────────────┘       │
└─────────────────────────┬───────────────────────────────┘
                          │ Electron IPC
┌─────────────────────────▼───────────────────────────────┐
│  Main Process                                            │
│                                                          │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │  TmuxManager (new)  │  │  SubAgentWatcher (mod)   │  │
│  │                     │  │                          │  │
│  │  - Spawns tmux via  │  │  - On new agent detected │  │
│  │    node-pty         │  │    calls TmuxManager     │  │
│  │  - One PTY per      │  │    .splitPane() which    │  │
│  │    worktree/session │  │    runs:                 │  │
│  │  - Executes tmux    │  │    tmux split-window     │  │
│  │    commands via     │  │    -t <session>          │  │
│  │    child_process    │  │    'tail -f <output>'    │  │
│  │  - Manages session  │  │                          │  │
│  │    lifecycle        │  │                          │  │
│  └─────────────────────┘  └──────────────────────────┘  │
│                                                          │
│  ┌─────────────────────┐                                 │
│  │  PTYManager (kept   │  Still used for the single     │
│  │  but simplified)    │  node-pty that hosts tmux      │
│  └─────────────────────┘                                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  tmux (system binary)                                    │
│                                                          │
│  Session: codrox-<worktree-hash>                        │
│  ┌─────────────────┬─────────────────┐                  │
│  │  Pane 0         │  Pane 1         │                  │
│  │  zsh (user)     │  claude --resume│                  │
│  │                 │                 │                  │
│  ├─────────────────┤                 │                  │
│  │  Pane 2         │                 │                  │
│  │  Agent: task... │                 │                  │
│  └─────────────────┴─────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. tmux Command Reference

All commands the app needs to execute via `child_process.execFile('tmux', [...])`:

### Session lifecycle

| Operation | Command |
|---|---|
| Check tmux installed | `tmux -V` |
| Create session | `tmux new-session -d -s "codrox-<id>" -c "<worktree-path>"` |
| List sessions | `tmux list-sessions -F "#{session_name}"` |
| Kill session | `tmux kill-session -t "codrox-<id>"` |
| Check session exists | `tmux has-session -t "codrox-<id>"` |

### Pane operations

| Operation | Command |
|---|---|
| Split horizontal | `tmux split-window -h -t "codrox-<id>"` |
| Split vertical | `tmux split-window -v -t "codrox-<id>"` |
| Split + run command | `tmux split-window -h -t "codrox-<id>" "<command>"` |
| Kill pane | `tmux kill-pane -t "codrox-<id>.<pane-index>"` |
| Select pane | `tmux select-pane -t "codrox-<id>.<pane-index>"` |
| List panes | `tmux list-panes -t "codrox-<id>" -F "#{pane_index} #{pane_pid} #{pane_current_command}"` |
| Send keys to pane | `tmux send-keys -t "codrox-<id>.<pane-index>" "<keys>" Enter` |
| Resize pane | `tmux resize-pane -t "codrox-<id>.<pane-index>" -x <cols> -y <rows>` |

### Attaching (how xterm connects)

| Operation | Command |
|---|---|
| Attach in PTY | node-pty spawns: `tmux attach-session -t "codrox-<id>"` OR `tmux new-session -A -s "codrox-<id>"` (create-or-attach) |

### Layout

| Operation | Command |
|---|---|
| Even horizontal | `tmux select-layout -t "codrox-<id>" even-horizontal` |
| Even vertical | `tmux select-layout -t "codrox-<id>" even-vertical` |
| Tiled | `tmux select-layout -t "codrox-<id>" tiled` |

---

## 4. Services to Create / Modify

### NEW: `src/main/services/TmuxManager.ts`

Core service that wraps all tmux interactions.

```
class TmuxManager {
  // Lifecycle
  checkInstalled(): Promise<boolean>           // runs `tmux -V`, returns true/false
  getVersion(): Promise<string>                // parses tmux version string
  
  // Session management
  createSession(id: string, cwd: string): Promise<void>
  destroySession(id: string): Promise<void>
  hasSession(id: string): Promise<boolean>
  listSessions(): Promise<string[]>
  
  // Pane management  
  splitPane(sessionId: string, direction: 'h' | 'v', command?: string): Promise<void>
  killPane(sessionId: string, paneIndex: number): Promise<void>
  sendKeys(sessionId: string, paneIndex: number, keys: string): Promise<void>
  listPanes(sessionId: string): Promise<PaneInfo[]>
  
  // Spawning (creates the node-pty that runs tmux attach)
  spawnAttached(sessionId: string): { ptyId: string }
  
  // Internal
  private exec(args: string[]): Promise<string>  // child_process.execFile wrapper
}
```

**Acceptance criteria:**
- All tmux commands are executed via `child_process.execFile` (not shell interpolation) to prevent injection
- Errors from tmux commands are caught and surfaced as typed errors
- Session names are sanitized (alphanumeric + hyphens only)

### NEW: `src/main/ipc/tmux.ipc.ts`

IPC handlers for renderer-to-main tmux commands.

```
Handlers:
  tmux:check          → TmuxManager.checkInstalled()
  tmux:create-session → TmuxManager.createSession(id, cwd)
  tmux:destroy-session→ TmuxManager.destroySession(id)
  tmux:split          → TmuxManager.splitPane(session, dir, cmd?)
  tmux:kill-pane      → TmuxManager.killPane(session, index)
  tmux:send-keys      → TmuxManager.sendKeys(session, index, keys)
  tmux:list-panes     → TmuxManager.listPanes(session)
  tmux:list-sessions  → TmuxManager.listSessions()
```

**Acceptance criteria:**
- All handlers validate input before delegating to TmuxManager
- Registered in the same pattern as existing `pty.ipc.ts` and `subagents.ipc.ts`

### MODIFY: `src/main/services/PTYManager.ts`

- Keep as-is but usage changes: instead of one PTY per tab, there is one PTY per worktree (running `tmux attach-session`)
- The `type` field becomes irrelevant (tmux handles what runs in each pane)
- `create()` now spawns `tmux new-session -A -s <session>` instead of raw shells or `claude`

**Acceptance criteria:**
- PTYManager still manages the node-pty lifecycle
- Only one PTY exists per active worktree (not per pane)

### MODIFY: `src/main/services/SubAgentWatcher.ts`

- When a new sub-agent is detected, instead of emitting `subagents:new` to the renderer (which then splits a React pane), it directly calls `TmuxManager.splitPane()` with a command like `tail -f <agent-output-file>` or `claude --session-id <id> --resume`
- Still emits an IPC event for the renderer to update any status indicators

**Acceptance criteria:**
- New agents create tmux panes, not React panes
- The renderer is notified for UI indicators (agent count badge, etc.) but does NOT manage pane layout

### MODIFY: `src/main/ipc/pty.ipc.ts`

- Simplify: remove per-pane PTY creation. The renderer asks for a tmux session PTY, not individual shell PTYs.
- May merge into `tmux.ipc.ts` or keep as a thin wrapper.

---

## 5. React Components to Change

### DELETE: Pane tree in `PaneRenderer.tsx`

The entire recursive `PaneRenderer` / `SplitPane` / `LeafPane` component tree is removed. tmux handles all pane splitting, resizing, and layout natively.

**What replaces it:** A single `<TmuxTerminal worktreeId={id} />` component that mounts one xterm.js instance filling the main content area.

### NEW: `src/renderer/src/components/TmuxTerminal.tsx`

Single xterm.js instance connected to the tmux session PTY.

```
Props: { worktreeId: string }

Behavior:
1. On mount: IPC call to create-or-attach tmux session for this worktree
2. Creates xterm.js Terminal + FitAddon
3. Connects to the single PTY via existing pty:output / pty:write IPC
4. ResizeObserver triggers pty:resize (tmux auto-adjusts its panes)
5. On unmount: does NOT destroy the tmux session (it persists)
```

**Acceptance criteria:**
- One xterm instance fills the entire main content area
- tmux renders its own pane borders, status bar inside xterm
- Resizing the Electron window resizes the xterm which resizes the tmux session

### NEW: `src/renderer/src/components/TmuxToolbar.tsx`

Minimal toolbar above the terminal with app-level controls.

```
Buttons:
- Split Horizontal (calls tmux:split with 'h')
- Split Vertical (calls tmux:split with 'v')  
- New Claude Pane (calls tmux:split with command='claude')
- Layout presets: Even-H, Even-V, Tiled
- Pane count indicator (polls tmux:list-panes)
```

**Acceptance criteria:**
- Toolbar buttons trigger IPC calls to main process
- Pane count updates within 2 seconds of changes
- Does NOT attempt to render pane layout — that is tmux's job

### MODIFY: `src/renderer/src/layout/MainContent.tsx`

- Replace `<TabBar /> + <PaneArea />` with `<TmuxToolbar /> + <TmuxTerminal />`
- The worktree switcher in the sidebar already handles switching worktrees; when the active worktree changes, the `TmuxTerminal` detaches from the old session and attaches to the new one
- Keep lifecycle mode rendering unchanged

**Acceptance criteria:**
- Terminal/Claude modes both render the tmux terminal (tmux manages what's inside)
- Mode picker still works: "Terminal" creates a tmux session with a shell pane, "Claude" creates one with `claude` running in the first pane
- Lifecycle phases render unchanged

### MODIFY: `src/renderer/src/tabs/TerminalTab.tsx` and `ClaudeTab.tsx`

- These are deleted. There are no longer separate tab components for terminal vs claude. Everything is a tmux pane.

### MODIFY: `src/renderer/src/store/tabStore.ts`

- Remove all pane tree state: `panesByWorktree`, `focusedPaneByWorktree`, `splitPane`, `closePane`, `setPaneTab`, `setPaneRatio`, `getOrCreatePane`, `setFocusedPane`, `getFocusedPaneId`
- Remove pane tree helpers: `makeLeaf`, `findNode`, `replaceNode`, `removePane`, `collectLeafIds`
- Keep tab list state IF tabs are repurposed (e.g., for editor tabs that are not terminal-based)
- Or simplify to just track which tmux session is active per worktree

### MODIFY: `src/shared/types/tabs.ts`

- Remove `PaneLeaf`, `PaneSplit`, `PaneNode` types
- `TerminalTab` and `ClaudeTab` types may be removed or consolidated
- Add `TmuxSession` type:
  ```
  interface TmuxSession {
    id: string           // "codrox-<worktree-hash>"
    worktreeId: string
    paneCount: number
  }
  ```

### MODIFY: `src/renderer/src/hooks/useSubAgentWatcher.ts`

- Simplify dramatically: no longer calls `openTab` or `splitPane` from the store
- Only listens for `subagents:new` to update a status indicator (badge, notification)
- The actual pane creation is handled server-side by `SubAgentWatcher` -> `TmuxManager`

### DELETE: `src/renderer/src/hooks/usePTY.ts`

- Replaced by a simpler `useTmuxPTY` hook (or inlined in `TmuxTerminal`) that connects one xterm to one tmux session PTY

---

## 6. Startup Flow

```
App launches
  │
  ├─ Main process: TmuxManager.checkInstalled()
  │   ├─ Found: continue normally
  │   └─ Not found: send 'tmux:not-installed' to renderer
  │       └─ Renderer shows install instructions modal
  │          macOS: "brew install tmux"
  │          Linux: "sudo apt install tmux" / "sudo pacman -S tmux"
  │
  ├─ Main process: TmuxManager.listSessions()
  │   └─ Reclaim any existing "codrox-*" sessions from previous app run
  │      (tmux sessions persist after app quit — this is a feature)
  │
  └─ User selects/creates worktree
      │
      ├─ TmuxManager.createSession("codrox-<hash>", worktreePath)
      │   └─ tmux new-session -d -s "codrox-<hash>" -c "<path>"
      │
      ├─ PTYManager.create(ptyId, { shell: 'tmux', args: ['attach-session', '-t', 'codrox-<hash>'] })
      │
      └─ Renderer: <TmuxTerminal> connects xterm to this PTY
```

---

## 7. Migration Path (Ordered Task List)

### Phase 1: Foundation — TmuxManager service (no UI changes yet)

**Task 1.1:** Create `src/main/services/TmuxManager.ts`
- Implement `checkInstalled()`, `getVersion()`, `exec()` helper
- Implement `createSession()`, `destroySession()`, `hasSession()`, `listSessions()`
- Implement `splitPane()`, `killPane()`, `sendKeys()`, `listPanes()`
- All methods use `child_process.execFile('tmux', args)` — no shell interpolation
- **AC:** Unit testable, all methods work against a real tmux binary in a test harness

**Task 1.2:** Create `src/main/ipc/tmux.ipc.ts`
- Register all `tmux:*` IPC handlers
- Wire to TmuxManager
- Register in main process alongside existing IPC modules
- **AC:** `window.api.invoke('tmux:check')` returns true on a machine with tmux installed

**Task 1.3:** Add tmux preload API types
- Extend `src/preload/index.ts` (or equivalent) with `tmux:*` channel types
- Extend `src/shared/types/` with `TmuxSession` and `TmuxPaneInfo` types
- **AC:** TypeScript compiles with no errors for tmux IPC calls from renderer

### Phase 2: Renderer — New tmux components (parallel to old system)

**Task 2.1:** Create `src/renderer/src/components/TmuxTerminal.tsx`
- Single xterm.js instance, full-size
- On mount: calls `tmux:create-session` then connects via PTY IPC
- FitAddon + ResizeObserver for auto-sizing
- **AC:** Renders a working tmux session in the Electron window

**Task 2.2:** Create `src/renderer/src/components/TmuxToolbar.tsx`
- Buttons for split-h, split-v, new-claude-pane, layout presets
- Each button calls the appropriate `tmux:*` IPC
- **AC:** Clicking "Split Horizontal" creates a visible new pane inside the tmux terminal

**Task 2.3:** Create `src/renderer/src/hooks/useTmuxPTY.ts`
- Extracted xterm connection logic (simplified from `usePTY.ts`)
- Manages one xterm <-> one PTY (the tmux session PTY)
- **AC:** Hook creates, connects, and cleans up xterm + PTY lifecycle correctly

**Task 2.4:** Create tmux install check UI
- On app start, if `tmux:check` returns false, show modal with install instructions
- **AC:** Modal appears when tmux is not found, provides correct install commands for macOS/Linux

### Phase 3: Integration — Wire tmux into MainContent

**Task 3.1:** Modify `MainContent.tsx`
- Replace `<TabBar /> + <PaneArea />` block with `<TmuxToolbar /> + <TmuxTerminal />`
- Mode picker: "Terminal" creates tmux session with shell, "Claude" creates tmux session with `claude` in first pane
- Keep lifecycle phase rendering untouched
- **AC:** Selecting "Terminal" or "Claude" mode shows a working tmux session; lifecycle mode still works

**Task 3.2:** Modify `SubAgentWatcher.ts` + `useSubAgentWatcher.ts`
- `SubAgentWatcher`: on new agent, call `TmuxManager.splitPane(sessionId, 'h', 'tail -f <output-file>')` or `TmuxManager.splitPane(sessionId, 'h', 'claude --session-id <id> --resume')`
- `useSubAgentWatcher`: simplify to only update a notification/badge, no pane manipulation
- **AC:** When Claude spawns a sub-agent, a new tmux pane appears automatically showing agent output

**Task 3.3:** Handle worktree switching
- When active worktree changes: detach from current tmux session PTY, attach to new session
- If new worktree has no session, create one
- If worktree had a previous session, reattach (session persisted by tmux)
- **AC:** Switching between worktrees in sidebar switches the visible tmux session; pane layout is preserved

### Phase 4: Cleanup — Remove old pane system

**Task 4.1:** Delete old components and hooks
- Delete: `PaneRenderer.tsx` (or gut it to a redirect)
- Delete: `usePTY.ts`
- Delete: `TerminalTab.tsx`, `ClaudeTab.tsx`
- Remove pane tree types from `tabs.ts`
- **AC:** No imports of deleted files remain; TypeScript compiles clean

**Task 4.2:** Simplify `tabStore.ts`
- Remove all pane tree state and actions
- Keep tab list if editor tabs are still used, otherwise remove tab concept entirely
- **AC:** Store is minimal; no dead code

**Task 4.3:** Simplify `PTYManager.ts`
- Remove per-tab PTY logic
- One PTY per worktree (the tmux attach process)
- Remove `type` field from PTYSession
- **AC:** PTYManager manages exactly one PTY per active worktree

**Task 4.4:** Clean up IPC
- Remove or simplify `pty.ipc.ts` handlers that are no longer needed (per-tab create/destroy)
- **AC:** No orphaned IPC handlers; all handlers have callers

### Phase 5: Polish

**Task 5.1:** tmux configuration
- Ship a `.tmux.conf` template that Codrox writes to a known location and passes via `tmux -f <path>`
- Configure: status bar style matching Codrox theme, mouse mode enabled, reasonable defaults
- **AC:** tmux sessions launched by Codrox have consistent styling regardless of user's `~/.tmux.conf`

**Task 5.2:** Session cleanup on worktree removal
- When a worktree is removed from the app, kill its tmux session
- On app quit: optionally kill all codrox sessions (or leave them for reattach)
- **AC:** No orphaned tmux sessions accumulate over time

**Task 5.3:** Error handling and edge cases
- tmux binary disappears mid-session (show reconnect UI)
- tmux session killed externally (detect via PTY exit, offer recreate)
- Multiple Codrox instances (namespace sessions to avoid conflicts)
- **AC:** App handles all error cases gracefully without crashing

---

## 8. Files Changed Summary

| Action | File | Reason |
|--------|------|--------|
| **CREATE** | `src/main/services/TmuxManager.ts` | Core tmux command wrapper |
| **CREATE** | `src/main/ipc/tmux.ipc.ts` | IPC handlers for tmux commands |
| **CREATE** | `src/renderer/src/components/TmuxTerminal.tsx` | Single xterm.js connected to tmux |
| **CREATE** | `src/renderer/src/components/TmuxToolbar.tsx` | App-level pane control buttons |
| **CREATE** | `src/renderer/src/hooks/useTmuxPTY.ts` | Simplified xterm-to-PTY hook |
| **MODIFY** | `src/renderer/src/layout/MainContent.tsx` | Swap PaneArea for TmuxTerminal |
| **MODIFY** | `src/main/services/SubAgentWatcher.ts` | Create tmux panes instead of IPC events |
| **MODIFY** | `src/main/services/PTYManager.ts` | Simplify to one PTY per worktree |
| **MODIFY** | `src/main/ipc/pty.ipc.ts` | Remove per-tab PTY handlers |
| **MODIFY** | `src/renderer/src/store/tabStore.ts` | Remove pane tree state |
| **MODIFY** | `src/shared/types/tabs.ts` | Remove PaneNode types, add TmuxSession |
| **MODIFY** | `src/renderer/src/hooks/useSubAgentWatcher.ts` | Simplify to notification only |
| **DELETE** | `src/renderer/src/hooks/usePTY.ts` | Replaced by useTmuxPTY |
| **DELETE** | `src/renderer/src/tabs/TerminalTab.tsx` | tmux handles terminal panes |
| **DELETE** | `src/renderer/src/tabs/ClaudeTab.tsx` | tmux handles claude panes |

---

## 9. Risk Mitigation

| Risk | Mitigation |
|---|---|
| tmux not installed | Startup check with clear install instructions modal |
| tmux version incompatibility | Check `tmux -V` >= 3.0; warn if older |
| User's `~/.tmux.conf` conflicts | Launch with `-f <codrox-tmux.conf>` to isolate config |
| Session name collisions | Namespace: `codrox-<sha256(worktree-path).slice(0,8)>` |
| Performance of `execFile` for tmux commands | Commands are sub-millisecond; no concern |
| Electron sandboxing blocks `child_process` | `child_process` runs in main process (not sandboxed); IPC bridge already exists |
| Windows support | tmux does not run on Windows natively; WSL would be required. Document this as out-of-scope for now. |

---

## 10. Success Criteria

1. User selects a worktree and sees a tmux session with their shell running
2. User can split panes using toolbar buttons OR native tmux keybindings
3. When Claude spawns sub-agents, new tmux panes appear automatically
4. Switching worktrees switches tmux sessions; layout is preserved
5. Closing and reopening the app reattaches to existing tmux sessions
6. No React pane tree code remains in the codebase
7. Editor tabs (if any) continue to work outside the tmux system
8. App shows clear instructions if tmux is not installed
