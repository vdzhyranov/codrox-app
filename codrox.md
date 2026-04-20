# Codrox — Product Spec

## AI-Native Development Environment with Parallel Agent Orchestration

> **Status:** Design Phase  
> **Last Updated:** April 2026  
> **Purpose:** Team alignment document — architecture, agent system, feature lifecycle

---

## 1. Vision

Modern IDEs were designed for a single developer writing code linearly. Claude Code changes the fundamental unit of work — instead of _you_ writing code, you direct agents that write code. The bottleneck shifts from typing to thinking: proposing, reviewing, orchestrating, verifying.

Codrox is built around that shift. It replaces the IDE with an **agent orchestration layer** — where the primary interface is not a file editor but a mission control for parallel AI agents, each working in its own isolated git worktree, each moving through a structured lifecycle from idea to verified implementation.

**Core bets:**

- Parallel worktrees are the natural unit of concurrent AI work, not tabs or windows
- Structured feature lifecycles produce better outcomes than freeform prompting
- The developer’s job is directing, reviewing, and verifying — not writing
- A terminal + file viewer + Claude session are tabs within a workspace, not separate apps

---

## 2. The Problem with Current Tooling

| Problem                                 | Current State                          | Codrox                                                                  |
| --------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| Claude Code is one session, one context | Sequential, blocks parallelism         | Multiple agents, multiple worktrees, running in parallel                  |
| No lifecycle for prompting              | Freeform chat, quality varies          | Structured phases: Propose → Grill → Research → Plan → Implement → Verify |
| Switching contexts is painful           | Alt-tab between terminal, IDE, browser | Everything in one layout: Claude, terminal, editor, web as tabs           |
| Can’t see what all agents are doing     | No central view                        | Agent panel with live status, progress, branch, task                      |
| Git complexity multiplied by AI speed   | AI makes changes faster than you track | File tree with change annotations, git diff view, per-worktree isolation  |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  TITLE BAR  — workspace switcher, command palette (⌘K), status  │
├──────────────┬──────────────────────────────┬───────────────────┤
│              │  PHASE TRACK                 │                   │
│  WORKTREE    │  ◈ Propose → ⚡ Grill →      │  AGENT PANEL      │
│  SIDEBAR     │  ⊡ Research → ≡ Plan →       │                   │
│              │  ⟩ Implement → ✓ Verify      │  Live agent cards │
│  — list of   ├──────────────────────────────│  per worktree:    │
│    worktrees │  MAIN CONTENT AREA           │  - task           │
│  — per-wt    │                              │  - progress       │
│    phase     │  Tab types:                  │  - branch         │
│    badge     │  • Claude session            │  - runtime        │
│  — progress  │  • Terminal                  │                   │
│    bar       │  • File editor               │  + Assign task    │
│              │  • Web view                  │    to agent       │
│  FILE TREE   │                              │                   │
│  GIT CHANGES │  PHASE FOOTER                │  PHASE CHAT       │
│              │  — status, advance/retreat   │  — Claude in      │
│              │    buttons                   │    current phase  │
└──────────────┴──────────────────────────────┴───────────────────┘
```

### Layout Zones

**Worktree Sidebar (left, 220px)**

- List of all worktrees for current workspace
- Each worktree shows: name, branch, current phase badge, progress bar
- Click to switch active worktree — entire main area updates
- `+` to fork new worktree (opens modal: feature name, branch, base, optional initial task)

**Main Content Area (flex center)**

- Phase track bar at top: visual progress through lifecycle, clickable to jump
- Tabbed content below: Claude / Terminal / Editor / Web
- Phase footer: current phase status + advance/retreat action buttons

**Agent Panel (right, 260–280px)**

- Live cards for all running agents across all worktrees
- Each card: agent name, task description, progress bar, branch tag, runtime
- Idle worktrees show “Assign task” prompt
- Clicking a card switches to that worktree

**Phase Chat (within right panel)**

- Claude’s commentary adapts to current phase
- Grill: adversarial, challenges your proposal
- Research: surfacing findings and conflicts
- Implement: narrating what it’s writing
- Verify: offering to fix what failed

---

## 4. Worktrees

### What is a Worktree?

A git worktree is a separate working directory linked to the same repository but checked out to a different branch. Codrox uses worktrees as the **primary unit of parallelism** — one worktree per feature, each with its own:

- Git branch (isolated from others)
- Claude Code session (separate context)
- Feature lifecycle state (which phase it’s in)
- Terminal environment
- File editor tabs

### Worktree Lifecycle

```
New Worktree created
       ↓
  [Feature named, branch forked from base]
       ↓
  Lifecycle starts at → Propose
       ↓
  ... phases proceed (see Section 5) ...
       ↓
  Verify complete → PR opened → Worktree archived
```

### Worktree Creation

Creating a new worktree requires:

- Feature name (human-readable label)
- Branch name (`feat/`, `fix/`, `refactor/` prefix convention)
- Base branch (default: `main`)
- Optional: initial task description (pre-fills the Propose brief)

Under the hood: `git worktree add ../project-{branch} -b {branch} {base}`

### Parallel Execution

Multiple worktrees can be in any phase simultaneously. A workspace might have:

- `feat/auth` → Implement (Agent α running)
- `feat/dashboard` → Plan (reviewing tasks)
- `fix/perf` → Research (Agent β running)
- `feat/search` → Grill (waiting on you to respond)

The agent panel shows all of these at once. You are the bottleneck at the review phases (Grill, Plan Verify); agents run autonomously at Research and Implement.

---

## 5. Feature Lifecycle

The lifecycle replaces freeform prompting with structured phases. Each phase has a defined purpose, a clear exit condition, and a specific mode for Claude.

```
◈ PROPOSE → ⚡ GRILL → ⊡ RESEARCH → ≡ PLAN → ⟩ IMPLEMENT → ✓ VERIFY
```

You can move forward (advance) or backward (retreat) at any phase footer. Jumping forward skips phases; jumping back does not erase work.

---

### Phase 1 — Propose `◈`

**Purpose:** Capture the feature brief clearly enough to stress-test it.

**You fill in:**

- Feature name
- Problem statement — what pain is being solved, for whom
- Proposed solution — high-level approach
- Success criteria — what does done look like, measurably
- Open questions / blockers — anything unresolved

**Claude’s role:** Passive reader. May ask 1–2 targeted clarifying questions in the side chat (e.g. migration strategy, existing code conflicts it already knows about from repo context).

**Exit condition:** Brief is complete enough that a challenge session would be productive.

**Advance action:** “Send to Grill →”

---

### Phase 2 — Grill `⚡`

**Purpose:** Adversarial review. Claude stress-tests the proposal by challenging assumptions, surfacing blind spots, and exposing gaps before any work begins.

**Claude’s mode:** Adversarial. Each message is a targeted challenge — about security implications, scale assumptions, migration complexity, edge cases, alternative approaches, dependencies you haven’t mentioned.

**You:** Defend your choices, revise them, or acknowledge gaps. Each exchange is captured.

**Scoring (displayed at end):**

- Clarity — is the problem well-defined?
- Completeness — are success criteria measurable?
- Risk Awareness — are the big risks named?
- Feasibility — is this achievable in scope?

Each scored 1–10. Warnings displayed for unresolved issues.

**Exit condition:** All open issues addressed OR explicitly acknowledged as acceptable risks. Score thresholds are advisory, not blocking.

**Advance action:** “Start Research →”

---

### Phase 3 — Research `⊡`

**Purpose:** Claude investigates the codebase and surfaces everything relevant before planning. This is the phase where Claude reads, not writes.

**Claude’s mode:** Investigative. Claude reads source files, `package.json`, schema, existing middleware, related PRs, and surfaces findings.

**Finding types:**

- `PATTERN` — existing code you should build on or be aware of
- `RISK` — conflicts, scale concerns, migration issues, security gaps
- `DEPENDENCY` — packages already present, APIs already available
- `INSIGHT` — non-obvious conclusions from research (e.g. mobile vs web client differences)

**Displayed stats:** Files analyzed, dependencies checked, risks found, opportunities spotted.

**Side chat:** You can interrogate findings — ask Claude to go deeper on a specific file, confirm a conflict, or check another area.

**Exit condition:** All findings reviewed. Risks acknowledged. You’re ready to turn findings into a plan.

**Advance action:** “Build Plan →”

---

### Phase 4 — Plan `≡`

**Purpose:** Convert research into a concrete, ordered, reviewable implementation plan.

**Claude produces:**

- Ordered task list (each task has: title, target file(s), detailed description, tags, effort estimate)
- Tasks are dependency-ordered — safe to implement sequentially or split across sub-agents
- Effort total shown (e.g. “6 tasks, ~11h estimated”)

**You can:**

- Expand any task to review its detail
- Edit task descriptions or reorder
- Split a task into sub-tasks
- Assign tasks to separate agents (parallel execution)
- Reject the plan and send back to Research

**Exit condition:** Plan approved. All tasks have enough detail to implement without further clarification.

**Advance action:** “Start Implementing →”

---

### Phase 5 — Implement `⟩`

**Purpose:** Claude executes the plan. This is the longest phase — primarily autonomous.

**Claude’s mode:** Execution. Works through tasks in order (or parallel if split). Each task:

1. Reads relevant files
1. Writes changes
1. Updates the task status (todo → active → done)
1. Emits to the live log

**Live displays:**

- Task checklist with spinning indicator on active task
- Line count per completed task (+added / -removed)
- Real-time log: timestamps, file paths, actions
- Running stats: files changed, lines added/removed, tests passing

**You can interrupt at any time** — the side chat is available during implementation. Claude will acknowledge, adjust, and continue.

**Exit condition:** All tasks marked done. Claude signals it’s ready for verification.

**Advance action:** “Run Verification →”

---

### Phase 6 — Verify `✓`

**Purpose:** Structured sign-off. Claude self-tests, you review, nothing merges without explicit approval.

**Claude runs:**

- Unit tests for all new functions
- Integration tests: happy path, error paths, security edge cases
- Specific test cases from the success criteria defined in Propose

**Verification checklist:**

- ✓ Pass — test passed cleanly
- ⚠ Warning — test passed but with a notable concern (e.g. race condition, performance)
- ✗ Fail — test failed, blocks advance

**For each warning/failure:** Claude surfaces the issue, explains it, and offers to fix it from the side chat.

**Summary bar:** Tests run, passing, warnings, failing.

**Exit condition:** All failures resolved. Warnings acknowledged. You click “Mark Complete.”

**Completion:** Worktree flagged as done. Option to open PR, archive worktree, or keep active.

---

## 6. Tab Types

Each worktree’s main content area supports multiple tab types. Tabs are per-worktree — switching worktrees shows that worktree’s tabs.

| Type       | Badge  | Purpose                                                          |
| ---------- | ------ | ---------------------------------------------------------------- |
| `claude`   | amber  | Claude Code session — primary AI interface for the current phase |
| `terminal` | green  | Full bash terminal scoped to the worktree directory              |
| `editor`   | purple | File viewer and editor with syntax highlighting and diff view    |
| `web`      | blue   | Embedded browser — for previewing localhost, docs, or any URL    |

**New tab** (`+` button): Picker for tab type, with defaults appropriate to current phase.

**Editor tab features:**

- File tabs within the editor (multiple open files)
- Diff view: lines added in green, removed in red, changed highlighted
- Modified files shown with amber dot indicator
- Clicking a file in the left sidebar opens it in the active editor tab

---

## 7. Agent Panel

### Agent Cards

Each running agent has a card showing:

- **Name** — auto-assigned (Agent α, β, γ…) or custom
- **Task** — current task description (from Plan phase)
- **Status dot** — running (green pulse), queued (amber), idle (grey)
- **Progress bar** — task completion % (estimated by Claude)
- **Branch tag** — which worktree/branch this agent is on
- **Runtime** — elapsed time since task started

### Assigning Tasks

If a worktree has no active agent, the panel shows an “Assign task to agent” prompt. Clicking opens a modal:

- Select worktree
- Choose from open tasks in its Plan, or write a freeform task
- Agent spins up, worktree enters Implement phase

### Agent Limits

Agents consume parallel Claude Code sessions. Recommended: no more than 4–6 simultaneous agents on a single machine (CPU/memory bound). Codrox will warn when approaching the limit.

---

## 8. Command Palette

Accessible via `⌘K`. Surfaces all major actions:

| Action             | Shortcut  |
| ------------------ | --------- |
| New Claude Session | `⌘N`      |
| New Worktree       | `⌘W`      |
| Split Terminal     | `⌘T`      |
| Assign Agent Task  | `⌘A`      |
| View Git Diff      | `⌘D`      |
| Switch Worktree    | `⌘1`–`⌘4` |
| Open File          | `⌘P`      |
| Command Palette    | `⌘K`      |

---

## 9. File Tree & Git Changes

The left sidebar has two persistent sections below the worktree list:

**File Tree**

- Shows the directory structure of the active worktree
- Files annotated by git status: `●` modified (amber), `+` added (green)
- Directories are collapsible
- Click any file to open in the active editor tab

**Git Changes**

- Compact list of changed files in the active worktree
- Each entry shows: change type badge (`M` / `A` / `D`) + filename
- Click to open diff in editor
- Designed for quick scan — not a full git client

---

## 10. Build Plan

### Phase 1 — Core Shell (MVP)

**Goal:** Working layout with real Claude Code integration in one worktree.

- [ ] Electron or Tauri app shell
- [ ] Layout: sidebar + main + agent panel
- [ ] Single worktree support (no parallel yet)
- [ ] Claude Code subprocess integration (PTY)
- [ ] Terminal tab (node-pty)
- [ ] File editor tab (CodeMirror or Monaco)
- [ ] Basic file tree from `fs`

**Exit:** You can open a repo, talk to Claude, edit files, run terminal commands.

---

### Phase 2 — Worktree Parallelism

**Goal:** Multiple worktrees, agent panel, real parallel execution.

- [ ] `git worktree` create/list/remove wrappers
- [ ] Per-worktree Claude sessions (separate PTY per worktree)
- [ ] Worktree switcher in sidebar
- [ ] Agent panel with live status polling
- [ ] Agent card state: running/queued/idle
- [ ] New worktree modal

**Exit:** You can run 3 worktrees in parallel, see all agents, switch between them.

---

### Phase 3 — Feature Lifecycle

**Goal:** Full lifecycle UI replacing freeform prompting.

- [ ] Lifecycle state machine per worktree (persisted to disk)
- [ ] Phase track component
- [ ] Propose form (structured brief)
- [ ] Grill mode (system prompt engineering for adversarial Claude)
- [ ] Grill scoring (Claude returns structured JSON scores)
- [ ] Research mode (Claude reads files, returns typed findings)
- [ ] Plan generation (Claude returns structured task list)
- [ ] Plan task expand/edit/reorder UI
- [ ] Implement progress tracking (parse Claude output for task completions)
- [ ] Verify checklist (Claude runs tests, returns structured results)
- [ ] Phase advance/retreat logic with exit condition checks

**Exit:** A feature can go from blank brief to verified implementation entirely within the lifecycle.

---

### Phase 4 — Polish & Integration

- [ ] Web tab (embedded webview, localhost detection)
- [ ] Git diff viewer (full diff in editor)
- [ ] PR creation from completed worktree
- [ ] Worktree archive/cleanup
- [ ] Multi-workspace support (multiple repos)
- [ ] Settings: agent limits, default branch, lifecycle preferences
- [ ] Keyboard shortcuts throughout

---

## 11. Open Questions

| Question                                    | Status   | Notes                                                                                 |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| Electron vs Tauri?                          | Open     | Electron: faster to build, larger bundle. Tauri: smaller, Rust backend, better perf.  |
| How does lifecycle state persist?           | Open     | JSON sidecar per worktree? SQLite?                                                    |
| How to detect task completion in Implement? | Open     | Parse Claude’s stdout for task markers, or structured tool calls                      |
| How does Grill scoring work?                | Open     | Claude returns JSON `{clarity: 8, completeness: 6, ...}` — needs prompt engineering   |
| Can two agents share a worktree?            | Open     | Probably not — risk of file conflicts. One agent per worktree.                        |
| Research phase: how deep does Claude read?  | Open     | Needs configurable depth limit (files, tokens). Current codebase context window risk. |
| Mobile clients for the web app?             | Deferred | Out of scope v1                                                                       |

---

## 12. Design Principles

**1. Phases over prompts.** Structured lifecycle phases produce better outcomes than open-ended chat. Each phase has a defined mode for Claude and a clear exit.

**2. Parallel by default.** The system assumes you’re running multiple features simultaneously. The UI is designed for overview first, detail on demand.

**3. You review, Claude executes.** Your time is spent at the review gates (Grill, Plan review, Verify sign-off). Autonomous phases (Research, Implement) run without requiring your attention.

**4. One workspace, everything visible.** No alt-tabbing between terminal, IDE, browser, chat. All surfaces are tabs within a worktree.

**5. Worktrees are cheap.** Creating a worktree for a feature costs seconds. The friction of starting a new parallel track should be near zero.

**6. Nothing merges without Verify.** The lifecycle ends at explicit sign-off. Incomplete verification blocks the advance button.

---

_This document reflects the design as of the session in April 2026. Implementation begins at Phase 1 of the Build Plan._
