# Forge OS -- Requirements Analysis Report

**Analyst:** Claude (Analyst Agent)  
**Date:** 2026-04-05  
**Source Document:** `/Applications/Development/codrox-app/codrox.md`  
**Document Status:** Design Phase, April 2026  
**Project Type:** Greenfield -- no existing codebase

---

## Table of Contents

1. Executive Summary
2. Functional Requirements Extraction
3. Non-Functional Requirements
4. Requirement Gaps -- Missing or Underspecified
5. Dependency Analysis
6. Risk Assessment
7. Ambiguity Audit
8. Prioritization Recommendations
9. Missing Acceptance Criteria
10. Edge Cases
11. Open Questions

---

## 1. Executive Summary

Forge OS is an AI-native development environment that replaces the traditional IDE with a mission control interface for parallel Claude Code agents working in isolated git worktrees. The product spec is well-structured with a clear vision, a six-phase feature lifecycle, and a four-phase build plan.

**Strengths of the spec:**
- Clear mental model (worktrees as the unit of parallelism)
- Well-defined feature lifecycle with six phases and exit conditions
- Concrete UI layout with zones and dimensions
- Honest open questions section acknowledging unknowns
- Build plan phased by dependency order

**Critical gaps:**
- No error handling specification for any component
- No authentication, authorization, or security model defined
- No data model or persistence schema
- No API contract between frontend and backend/subprocess layer
- Claude Code integration mechanics are almost entirely unspecified
- No performance requirements or benchmarks
- No specification for what happens when things fail (agents crash, git conflicts, network issues)

---

## 2. Functional Requirements Extraction

### 2.1 Application Shell

| ID | Requirement | Source | Completeness |
|----|------------|--------|-------------|
| FR-001 | Desktop application (Electron or Tauri -- undecided) | Sec 10, 11 | Incomplete -- framework not chosen |
| FR-002 | Three-zone layout: sidebar (220px), main (flex), agent panel (260-280px) | Sec 3 | Complete |
| FR-003 | Title bar with workspace switcher, command palette trigger, status | Sec 3 | Partial -- "status" undefined |
| FR-004 | Command palette accessible via Cmd+K | Sec 8 | Complete |
| FR-005 | Keyboard shortcuts for 8 defined actions | Sec 8 | Complete |

### 2.2 Worktree Management

| ID | Requirement | Source | Completeness |
|----|------------|--------|-------------|
| FR-010 | Create worktree with: feature name, branch name, base branch, optional task | Sec 4 | Complete |
| FR-011 | List all worktrees for current workspace | Sec 3, 4 | Complete |
| FR-012 | Switch active worktree -- entire main area updates | Sec 3 | Partial -- no transition spec |
| FR-013 | Archive/cleanup worktree after completion | Sec 5, 10 | Incomplete -- no archive behavior defined |
| FR-014 | Branch naming convention enforcement (feat/, fix/, refactor/) | Sec 4 | Partial -- advisory or enforced? |
| FR-015 | Worktree creation executes `git worktree add` under the hood | Sec 4 | Complete |
| FR-016 | Each worktree has isolated: branch, Claude session, lifecycle state, terminal, editor tabs | Sec 4 | Complete |

### 2.3 Feature Lifecycle (6 Phases)

| ID | Requirement | Source | Completeness |
|----|------------|--------|-------------|
| FR-020 | Phase 1 -- Propose: Structured brief form (name, problem, solution, criteria, questions) | Sec 5 | Complete |
| FR-021 | Phase 2 -- Grill: Adversarial Claude review with scoring (clarity, completeness, risk, feasibility, each 1-10) | Sec 5 | Partial -- scoring thresholds advisory but undefined |
| FR-022 | Phase 3 -- Research: Claude reads codebase, returns typed findings (PATTERN, RISK, DEPENDENCY, INSIGHT) | Sec 5 | Partial -- depth limits unspecified |
| FR-023 | Phase 4 -- Plan: Ordered task list with title, files, description, tags, effort estimate | Sec 5 | Complete |
| FR-024 | Phase 5 -- Implement: Autonomous execution with live progress display | Sec 5 | Partial -- task completion detection unspecified |
| FR-025 | Phase 6 -- Verify: Structured test execution with pass/warning/fail checklist | Sec 5 | Partial -- test execution mechanism unspecified |
| FR-026 | Phase advance/retreat navigation via footer buttons | Sec 5 | Complete |
| FR-027 | Forward jumps skip phases; backward jumps preserve work | Sec 5 | Partial -- what state is preserved on retreat? |
| FR-028 | Exit conditions per phase must be met to advance | Sec 5 | Partial -- are they enforced or advisory? |

### 2.4 Agent System

| ID | Requirement | Source | Completeness |
|----|------------|--------|-------------|
| FR-030 | Agent cards showing: name, task, status, progress, branch, runtime | Sec 7 | Complete |
| FR-031 | Agent status states: running (green pulse), queued (amber), idle (grey) | Sec 7 | Complete |
| FR-032 | Auto-assigned agent names (Greek alphabet) or custom | Sec 7 | Complete |
| FR-033 | Task assignment modal: select worktree, choose plan task or freeform | Sec 7 | Complete |
| FR-034 | Agent limit warning at 4-6 simultaneous agents | Sec 7 | Incomplete -- is this hard limit or soft warning? Configurable? |
| FR-035 | One agent per worktree | Sec 11 | Incomplete -- stated as "probably" in open questions |

### 2.5 Tab System

| ID | Requirement | Source | Completeness |
|----|------------|--------|-------------|
| FR-040 | Claude tab: AI session for current phase | Sec 6 | Partial -- how does phase context get injected? |
| FR-041 | Terminal tab: bash terminal scoped to worktree directory | Sec 6 | Complete |
| FR-042 | Editor tab: syntax highlighting, diff view, file tabs within | Sec 6 | Partial -- no language list, no save behavior |
| FR-043 | Web tab: embedded browser for localhost and URLs | Sec 6 | Partial -- security sandbox unspecified |
| FR-044 | New tab picker with phase-appropriate defaults | Sec 6 | Incomplete -- which defaults for which phases? |
| FR-045 | Tabs are per-worktree | Sec 6 | Complete |

### 2.6 File Tree and Git

| ID | Requirement | Source | Completeness |
|----|------------|--------|-------------|
| FR-050 | Directory tree with collapsible folders | Sec 9 | Complete |
| FR-051 | Git status annotations on files (modified, added) | Sec 9 | Partial -- deleted files not mentioned |
| FR-052 | Git changes list with change type badges (M/A/D) | Sec 9 | Complete |
| FR-053 | Click file to open in editor | Sec 9 | Complete |
| FR-054 | Click changed file to open diff | Sec 9 | Complete |

### 2.7 Workspace Management

| ID | Requirement | Source | Completeness |
|----|------------|--------|-------------|
| FR-060 | Workspace switcher in title bar | Sec 3 | Incomplete -- no spec for workspace creation/management |
| FR-061 | Multi-workspace support (multiple repos) | Sec 10 | Incomplete -- deferred to Phase 4, no detail |

---

## 3. Non-Functional Requirements

The spec is almost entirely silent on non-functional requirements. The following are implied but never stated.

### 3.1 Performance

| Area | What the spec implies | What is missing |
|------|----------------------|-----------------|
| Agent startup | Worktrees "cost seconds" to create | No target latency for worktree creation |
| UI responsiveness | Live status polling for agent panel | No polling interval, no max latency target |
| Claude subprocess | PTY integration | No specification for output buffering, streaming rate |
| File tree rendering | Large repos implied | No file count limit, no lazy-loading spec |
| Memory footprint | 4-6 agents recommended | No per-agent memory budget, no total app memory target |

### 3.2 Scalability

| Area | Gap |
|------|-----|
| Maximum worktrees | Not specified -- what happens at 20? 50? |
| Maximum open tabs per worktree | Not specified |
| Repository size limits | Not addressed -- monorepos with 100k+ files? |
| Lifecycle state storage | Not specified -- could become bottleneck with many worktrees |

### 3.3 Security

| Area | Gap |
|------|-----|
| Web tab sandboxing | Embedded browser with no security model mentioned |
| Claude API credentials | How are they stored? Keychain? Environment variable? |
| Terminal access scope | Full bash access -- any filesystem restrictions? |
| Worktree isolation | Git-level only -- no process-level sandboxing mentioned |
| Data at rest | Lifecycle state may contain sensitive project details |

### 3.4 Reliability

| Area | Gap |
|------|-----|
| Agent crash recovery | Not mentioned at all |
| Application crash recovery | No session restore specification |
| Git operation failures | No error handling for merge conflicts, disk full, etc. |
| Network failures | Claude requires network -- no offline behavior defined |

### 3.5 Accessibility

Not mentioned anywhere in the spec. Keyboard navigation partially covered by shortcuts, but no screen reader, contrast, or other a11y specifications.

### 3.6 Platform Support

| Area | Gap |
|------|-----|
| Target OS | macOS implied (Cmd shortcuts), Windows/Linux unclear |
| Minimum OS version | Not specified |
| Required dependencies | Git version requirements not specified |

---

## 4. Requirement Gaps -- Missing or Underspecified

### 4.1 Critical Gaps (Block Planning)

**GAP-001: Claude Code Integration Mechanics**  
The spec treats Claude Code as a black box. The following are unspecified:
- How does Forge OS spawn a Claude Code session? (CLI subprocess? SDK? API?)
- How does it inject phase-specific system prompts? (Grill mode, Research mode, etc.)
- How does it receive structured output? (JSON parsing from stdout? Tool calls? MCP?)
- How does it detect task completion during Implement phase? (Acknowledged in open questions but critical for core functionality)
- How does it trigger and collect test results during Verify phase?
- What Claude Code version/API is targeted?
- How does the system handle Claude Code rate limits or quota exhaustion?

**Impact:** This is the most critical integration in the entire product. Without specifying this interface, no implementation plan is reliable.

**GAP-002: Data Model and Persistence**  
The spec acknowledges persistence is unresolved (JSON sidecar vs SQLite) but does not define the data model at all:
- What fields comprise a worktree record?
- What fields comprise a lifecycle state record?
- How are Grill scores stored?
- How are Research findings stored?
- How are Plan tasks stored?
- How are Verify results stored?
- Where do tab states persist?
- How is workspace configuration stored?

**Impact:** Every feature depends on a data model. Without it, each component will invent its own, leading to inconsistency.

**GAP-003: Error Handling Strategy**  
Zero error states are defined anywhere in the spec:
- What happens when `git worktree add` fails? (Branch already exists, disk full, dirty state)
- What happens when a Claude session crashes mid-Implement?
- What happens when the user closes the app during an active agent run?
- What happens when two worktrees have conflicting changes to the same file?
- What happens when a phase exit condition is not met but the user force-advances?

**Impact:** Error handling typically constitutes 40-60% of production code. Its absence from the spec means massive underestimation of effort.

**GAP-004: IPC Architecture**  
No specification for how the UI (renderer process) communicates with backend services:
- Electron: IPC bridge between renderer and main process
- Tauri: Rust command invocations from frontend
- How does the UI get real-time updates from agent processes?
- WebSocket? Event emitter? Polling?

**Impact:** This architectural decision shapes every feature's implementation.

### 4.2 Significant Gaps (Block Detailed Design)

**GAP-005: Phase Chat Behavior**  
Section 3 mentions "Phase Chat" in the right panel. Section 5 describes Claude's mode per phase. But:
- Is Phase Chat a separate Claude session from the main Claude tab?
- If so, does it share context with the main session?
- What is the token/context budget per phase chat?
- Can Phase Chat messages influence the main session?

**GAP-006: Agent Progress Estimation**  
Section 7 states progress bars show "task completion % (estimated by Claude)." This is hand-waved:
- How does Claude estimate completion percentage?
- What granularity? Per-task? Per-file? Per-line?
- How often does the estimate update?
- What does the progress bar show when estimation is inaccurate?

**GAP-007: Plan Task Effort Estimation**  
Section 5 (Plan phase) mentions effort estimates per task (e.g., "~11h estimated"). But:
- What unit? Hours of human time? Agent time? Wall clock time?
- How is this calculated?
- Is it displayed to calibrate expectations or used for scheduling?

**GAP-008: Worktree Archive Behavior**  
"Worktree archived" is mentioned as a completion state but never defined:
- Does archive mean `git worktree remove`?
- Is the branch deleted? Preserved?
- Is lifecycle history preserved? Where?
- Can an archived worktree be restored?

**GAP-009: PR Creation**  
"Option to open PR" at completion, but:
- Against which remote? (Assumes single remote)
- PR template? Auto-filled from lifecycle data?
- Which git hosting service? GitHub? GitLab? Bitbucket?
- Is this a shell-out to `gh pr create` or a built-in integration?

**GAP-010: Web Tab Security**  
An embedded browser (webview) is a significant security surface:
- Can it access the filesystem?
- Can it execute arbitrary JavaScript?
- Is it sandboxed from the main application?
- Can it access localhost services started by the terminal?
- What about cross-origin restrictions?

### 4.3 Minor Gaps (Clarify Before Implementation)

- **GAP-011:** File editor -- which languages are supported for syntax highlighting? Read-write or view-only? Auto-save or manual save?
- **GAP-012:** Terminal -- single per worktree or multiple? Can terminals be split?
- **GAP-013:** Workspace switcher -- how are workspaces created, named, configured, deleted?
- **GAP-014:** Sidebar width -- fixed at 220px or resizable? Same for agent panel at 260-280px.
- **GAP-015:** Dark mode / theming -- not mentioned at all.
- **GAP-016:** Update mechanism -- how does the desktop app update itself?
- **GAP-017:** Logging and diagnostics -- no specification for application logs, crash reports, telemetry.

---

## 5. Dependency Analysis

### 5.1 Critical Path

```
Framework Decision (Electron vs Tauri)
    |
    v
App Shell + IPC Architecture
    |
    +---> PTY/Terminal Integration
    |         |
    |         v
    |     Claude Code Subprocess Integration  <-- HIGHEST RISK
    |         |
    |         v
    |     Single Worktree Working End-to-End
    |
    +---> File System Watcher + File Tree
    |
    +---> Editor Component (CodeMirror/Monaco)
    |
    v
Git Worktree Management Layer
    |
    v
Multi-Worktree Switching + Per-Worktree State
    |
    v
Agent Panel + Process Manager
    |
    v
Data Model + Persistence Layer    <-- BLOCKS LIFECYCLE
    |
    v
Feature Lifecycle State Machine
    |
    +---> Propose Form UI
    +---> Grill Mode (requires Claude prompt engineering)
    +---> Research Mode (requires Claude structured output)
    +---> Plan Mode (requires Claude structured output)
    +---> Implement Mode (requires task completion detection)
    +---> Verify Mode (requires test execution integration)
    |
    v
PR Creation + Worktree Archive
```

### 5.2 External Dependencies

| Dependency | Risk Level | Notes |
|-----------|-----------|-------|
| Claude Code CLI | HIGH | Entire product depends on its subprocess API stability. No versioning mentioned. |
| Git (system) | LOW | Stable, but minimum version for worktree features needed (2.15+) |
| node-pty | MEDIUM | Native module, platform-specific compilation issues common |
| CodeMirror or Monaco | LOW | Mature projects, well-documented |
| Electron or Tauri | HIGH | Framework choice affects every subsequent implementation decision |
| Git hosting API (GitHub/GitLab) | LOW | Only needed for PR creation, can be deferred |

### 5.3 Internal Dependencies

| Component | Depends On | Blocks |
|-----------|-----------|--------|
| Worktree switching | Data model, git layer | Everything multi-worktree |
| Agent panel | Process manager, Claude integration | Parallel execution UX |
| Phase Chat | Claude integration, phase state machine | Lifecycle experience |
| Grill scoring | Claude structured output parsing | Phase 2 exit conditions |
| Research findings | Claude structured output parsing | Phase 3 display |
| Plan tasks | Data model, Claude structured output | Phase 4-5 execution |
| Verify checklist | Test runner integration, Claude integration | Phase 6 completion |

---

## 6. Risk Assessment

### 6.1 Technical Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|-----------|
| **Claude Code subprocess API instability** -- Claude Code is under active development; its CLI interface, output format, and capabilities may change without notice | Critical | High | Pin to a specific Claude Code version. Define an abstraction layer. Monitor changelogs. |
| **Structured output reliability** -- Grill scores, Research findings, Plan tasks, and Verify results all require Claude to return structured JSON. LLM output is inherently non-deterministic. | High | High | Implement robust JSON parsing with fallback. Define schemas with validation. Handle malformed responses gracefully. |
| **PTY management complexity** -- Managing multiple PTY sessions across process lifecycle, resize events, and crash recovery is notoriously difficult | High | Medium | Use battle-tested PTY libraries. Implement process supervisor pattern. Extensive integration testing. |
| **Memory pressure from parallel agents** -- Each Claude Code session consumes significant memory. 4-6 parallel sessions plus Electron/Tauri renderer could exceed 8-16GB easily. | High | Medium | Profile early. Implement agent queuing. Make limits configurable. Consider session hibernation for inactive worktrees. |
| **Git worktree edge cases** -- Worktrees sharing a single .git directory can have subtle issues: stale locks, detached HEADs, index corruption during parallel operations | Medium | Medium | Wrap all git operations in a serialized queue or mutex. Implement health checks. Handle stale lock files. |
| **Electron vs Tauri decision paralysis** -- This undecided choice blocks all implementation. Both have significant tradeoffs that compound over time. | Medium | High | Make the decision now, before Phase 1. Prototype both for 2 days max, then commit. |

### 6.2 Scope Risks

| Risk | Area | Prevention |
|------|------|-----------|
| **Lifecycle phases become a full workflow engine** | Feature Lifecycle | Hard-code the six phases. No custom phases in v1. No branching. Linear only. |
| **Editor becomes a full IDE** | Editor Tab | Scope to viewing and light editing. No LSP, no debugging, no extensions in v1. |
| **Web tab becomes a browser** | Web Tab | Scope to single-page preview. No navigation bar. No devtools. No history. |
| **Git integration grows into a Git client** | Git Changes | Scope to read-only status display and diff viewing. No write operations beyond what agents perform. |
| **Multi-workspace becomes project management** | Workspace | One repo per workspace. No cross-workspace features in v1. |

### 6.3 Feasibility Concerns

| Concern | Assessment |
|---------|-----------|
| **Can Claude Code be reliably controlled via subprocess?** | Unknown. Claude Code's CLI is designed for interactive use. Programmatic control may require MCP or an SDK that does not exist yet. This is the single highest feasibility risk. |
| **Can 4-6 Claude sessions run on a single machine?** | Depends on whether sessions are local or API-backed. If API-backed, the bottleneck is rate limits and cost, not local resources. |
| **Can lifecycle phases be enforced via prompt engineering alone?** | Partially. Requires careful system prompts. Structured JSON output is the weak link. |
| **Is the build plan's Phase 1 achievable as an MVP?** | Yes, if the framework decision is made immediately. The Phase 1 scope is a known pattern with existing examples. |

---

## 7. Ambiguity Audit

| # | Location | Statement | Ambiguity | Impact |
|---|----------|-----------|-----------|--------|
| A-01 | Sec 5, Phase 2 | "Score thresholds are advisory, not blocking" | If thresholds are advisory, what enforces quality? Is there any gate at Grill, or can the user always skip? | Medium |
| A-02 | Sec 5, General | "Jumping forward skips phases; jumping back does not erase work" | What does "does not erase work" mean concretely? If you retreat from Plan to Research, is the plan preserved? | High |
| A-03 | Sec 5, Phase 6 | "Claude runs: Unit tests for all new functions" | Does Claude write the tests, or run pre-existing tests? If it writes them, where are they stored? | High |
| A-04 | Sec 7 | "Recommended: no more than 4-6 simultaneous agents" | Soft recommendation, hard limit, or configurable? | Medium |
| A-05 | Sec 4 | "Lifecycle starts at Propose" | Is Propose mandatory? Can a user skip directly to Implement for a quick fix? | Medium |
| A-06 | Sec 3 | "Phase Chat -- Claude's commentary adapts to current phase" | Is Phase Chat the same Claude session as the Claude tab, or a separate one? | High |
| A-07 | Sec 5, Phase 5 | "You can interrupt at any time" | What happens to the agent's current operation when interrupted? | High |
| A-08 | Sec 10, Phase 1 | "Electron or Tauri app shell" | If Tauri is chosen, the PTY integration path is entirely different. The build plan does not branch. | High |
| A-09 | Sec 12 | "Nothing merges without Verify" | But Section 5 says phase skipping is allowed. These contradict. | High |
| A-10 | Sec 5, Phase 4 | "Assign tasks to separate agents (parallel execution)" | Implies multiple agents per worktree, contradicting Section 11 "one agent per worktree." | High |
| A-11 | Sec 8 | "Switch Worktree: Cmd+1 through Cmd+4" | Why only 4? The spec supports unlimited worktrees. | Low |
| A-12 | Sec 5, Phase 3 | "related PRs" | Implies GitHub API integration during Research phase. Not mentioned elsewhere. | Medium |

---

## 8. Prioritization Recommendations

### 8.1 Recommended Build Order (Revised)

The spec's four-phase build plan is reasonable but needs a Phase 0:

**Phase 0 -- Decisions and Prototyping (1 week)**
1. Decide Electron vs Tauri -- prototype Claude Code PTY integration in both
2. Define the Claude Code integration contract (CLI subprocess? SDK? MCP?)
3. Define the data model for worktree state and lifecycle state
4. Choose persistence mechanism (JSON sidecar recommended for v1 simplicity)

**Phase 1 -- Core Shell (as spec, 3-4 weeks)**
- App shell with three-zone layout
- Single worktree with PTY terminal
- Claude Code subprocess integration (single session)
- File tree from filesystem
- Editor tab with CodeMirror/Monaco

**Phase 2 -- Worktree Parallelism (as spec, 2-3 weeks)**
- Git worktree create/list/remove
- Per-worktree state isolation
- Worktree switcher
- Agent panel with live status
- Agent process manager

**Phase 3 -- Feature Lifecycle (as spec, 4-6 weeks)**
- Lifecycle state machine
- Propose and Grill phases first (lowest Claude integration complexity)
- Plan phase next (structured output required)
- Implement phase (task tracking, progress detection)
- Research and Verify last (deepest Claude integration)

**Phase 4 -- Polish (2-3 weeks)**
- Git diff viewer
- PR creation
- Keyboard shortcuts
- Settings
- Error handling hardening

### 8.2 What Can Wait (Post-v1)

- Multi-workspace support
- Web tab (high effort, low core priority)
- Custom agent names
- Configurable lifecycle (custom phases, optional phases)
- Dark mode / theming
- Plugin/extension system
- Cross-platform support (ship macOS first)

### 8.3 What Should Be Cut from v1

- "Related PRs" surfacing in Research phase (requires git hosting API)
- Multi-workspace (adds complexity without core value)

---

## 9. Missing Acceptance Criteria

| Feature | Missing Criterion | Suggested Measurable Test |
|---------|-------------------|--------------------------|
| Worktree creation | How fast must it complete? | Completes in under 5 seconds for a repo up to 1GB |
| Worktree switching | How fast must the UI update? | Renders complete UI in under 500ms |
| Claude session startup | How fast until interactive? | Interactive within 10 seconds of worktree activation |
| Agent panel updates | How current must status be? | Reflects reality within 2 seconds |
| File tree rendering | How large a repo? | Renders within 1 second for repos with up to 50,000 files |
| Editor tab | What constitutes "working"? | Open, view, edit, save files with syntax highlighting for JS/TS/Python/Rust minimum |
| Terminal tab | What constitutes "working"? | Full interactive bash with resize, copy/paste, ANSI color rendering |
| Grill scoring | What constitutes valid output? | Valid JSON with four score fields, each integer 1-10, within 30 seconds |
| Plan generation | What constitutes a valid plan? | Ordered task list where each task has title, files array, description, and effort string |
| Implement progress | What constitutes accurate tracking? | Task status transitions detected and displayed within 5 seconds |
| Verify phase | What constitutes "tests run"? | At least one test command executed and pass/fail result parsed and displayed |
| Phase advance | What enforces exit conditions? | Advance button disabled when blocking exit conditions are not met |
| App stability | Acceptable crash rate? | No crash during a 4-hour session with 3 active agents |

---

## 10. Edge Cases

### 10.1 Git and Worktree

| # | Scenario | Expected Behavior (Undefined) |
|---|----------|-------------------------------|
| EC-01 | User creates worktree for branch that already exists | Show error? Switch to existing? Offer rename? |
| EC-02 | Base branch deleted or force-pushed since worktree creation | Warn? Rebase? Block operations? |
| EC-03 | Two worktrees modify the same file | No detection specified. Conflicts surface only at merge. |
| EC-04 | `git worktree add` fails due to uncommitted changes | Error handling not specified |
| EC-05 | Worktree directory manually deleted outside the app | Stale reference. Should detect and clean up. |
| EC-06 | Repository uses submodules | Worktree + submodules behavior is complex and unaddressed |
| EC-07 | Repository is a shallow clone | Worktree operations may fail |

### 10.2 Agent and Process

| # | Scenario | Expected Behavior (Undefined) |
|---|----------|-------------------------------|
| EC-10 | Claude Code process killed by OS (OOM) | Card should reflect crash. Offer restart. |
| EC-11 | Claude API rate limit hit during Implement | Pause? Retry? Notify user? |
| EC-12 | User closes app while agents running | Kill agents? Preserve? Resume on reopen? |
| EC-13 | Agent produces output faster than UI renders | Buffering strategy needed |
| EC-14 | Agent runs indefinitely (stuck in loop) | Timeout? User kill? No mechanism specified. |
| EC-15 | Claude context window exhausted mid-feature | Truncate? New session with summary? |

### 10.3 Lifecycle

| # | Scenario | Expected Behavior (Undefined) |
|---|----------|-------------------------------|
| EC-20 | Retreat from Verify to Implement -- are test results preserved? | "Does not erase work" is unclear for test results |
| EC-21 | Force-advance from Propose to Implement, skipping Grill/Research/Plan | Implement needs a Plan. What happens with no plan? |
| EC-22 | Grill session produces invalid JSON scores | Retry? Default scores? Skip scoring? |
| EC-23 | Research on empty/new repository | Nothing to analyze. User advances with no findings. |
| EC-24 | Plan has 0 tasks | Nothing to execute at Implement. |
| EC-25 | All Verify tests fail | Can user "Mark Complete" anyway, or blocked? |

### 10.4 UI

| # | Scenario | Expected Behavior (Undefined) |
|---|----------|-------------------------------|
| EC-30 | 20+ worktrees -- sidebar overflow | Scrollable? Searchable? |
| EC-31 | Very long feature/branch names | Truncation strategy needed |
| EC-32 | Window resized to very small dimensions | Minimum window size? Panel collapse? |
| EC-33 | 50+ tabs in one worktree | Tab overflow behavior |

---

## 11. Open Questions

### From the Spec (Section 11)

- [ ] Electron vs Tauri? -- Blocks all implementation.
- [ ] How does lifecycle state persist? (JSON sidecar vs SQLite) -- Blocks data model design.
- [ ] How to detect task completion in Implement phase? -- Blocks Phase 5 implementation.
- [ ] How does Grill scoring work? (Prompt engineering for structured JSON) -- Blocks Phase 2 implementation.
- [ ] Can two agents share a worktree? -- Blocks agent architecture design.
- [ ] Research phase depth limits? -- Blocks Phase 3 implementation.

### Surfaced by This Analysis

- [ ] What is the Claude Code integration contract? (Subprocess CLI? SDK? MCP?) -- Single most critical architectural question.
- [ ] What is the IPC architecture between UI and backend? -- Blocks all feature implementation patterns.
- [ ] Is Phase Chat a separate Claude session from the Claude tab? -- Affects session management, context budgets, and cost.
- [ ] Are lifecycle phase exit conditions enforced (blocking) or advisory? -- Design principle 6 vs phase skipping contradiction.
- [ ] What happens to running agents when the app closes? -- Determines process lifecycle management approach.
- [ ] How does task splitting in Plan phase work with one-agent-per-worktree constraint?
- [ ] What is the target platform? macOS only? Cross-platform?
- [ ] What is the error recovery strategy for Claude structured output failures?
- [ ] What is the minimum Git version required?
- [ ] Does the editor support write operations, or is it view-only while agents work?

---

## Appendix: Recommendations Summary (Prioritized)

### Must Resolve Before Planning

1. **Decide Electron vs Tauri** -- Every downstream decision depends on this.
2. **Define the Claude Code integration contract** -- Prototype the subprocess interaction.
3. **Resolve the Phase Chat vs Claude Tab session architecture** -- One session or two per worktree is a 2x difference in resource consumption.
4. **Define the data model** -- Even a rough schema for worktree state, lifecycle state, and plan tasks.
5. **Resolve the phase enforcement contradiction** -- Either skipping is allowed or it is blocked.

### Should Resolve Before Implementation

6. Define error handling strategy for each component category.
7. Set performance targets for the acceptance criteria listed in Section 9.
8. Define agent timeout and crash recovery behavior.
9. Specify editor read/write permissions during active agent execution.
10. Define cross-platform scope (macOS-first recommended).

### Can Resolve During Implementation

11. Sidebar and panel resize behavior.
12. Tab overflow strategy.
13. Dark mode / theming approach.
14. Keyboard shortcut conflicts with OS-level shortcuts.
15. Telemetry and crash reporting approach.
