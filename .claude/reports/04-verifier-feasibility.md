## Verification Report — Forge OS Build Plan

### Verdict
**Status:** INCOMPLETE — plan is not ready to execute without revision
**Confidence:** high
**Blockers:** 7 critical gaps

---

### Evidence

| Check | Result | Source | Notes |
|-------|--------|--------|-------|
| Spec completeness | partial | `codrox.md` sections 1–12 | 7 open questions unresolved, several tasks underspecified |
| Phase ordering | pass | Sections 5 and 10 | Dependency graph is logically correct |
| Exit criteria measurability | partial | Per-phase exit conditions | Phases 3 and 4 exit conditions are vague or absent |
| Technical feasibility | partial | Section 10 task lists | PTY multiplexing, structured output parsing, Grill scoring are harder than implied |
| Integration risk (Phase 1+2) | fail | Architecture analysis | Session ownership and state scoping not designed for N worktrees in Phase 1 |
| Scope realism | fail | All 4 phases | No timeline; realistic estimate is 22–32 weeks for a 2-person team |
| Open questions impact | fail | Section 11 | 4 of 7 open questions must be resolved before Phase 1 begins |

---

### Acceptance Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Phases are in correct dependency order | VERIFIED | Phase 1 → 2 → 3 → 4 is correct. Each phase's exit gates the next. |
| 2 | Each phase has complete task lists | PARTIAL | Phase 1 missing: IPC layer, state management choice, Claude integration contract, credential storage. Phase 2 missing: session persistence, crash recovery. Phase 3 missing: system prompt management, token budget controls, structured output schema. Phase 4 missing: auto-update, exit condition. |
| 3 | Exit criteria are measurable | PARTIAL | Phases 1 and 2 are measurable. Phase 3 is vague ("feature can go from blank brief to verified implementation" is not testable). Phase 4 has no exit condition at all. |
| 4 | Tasks are technically buildable as described | PARTIAL | See technical feasibility section below. |
| 5 | Phases compose without integration breaks | PARTIAL | Phase 1+2 boundary has high integration risk unless Phase 1 designs for N sessions from the start. |
| 6 | Scope is realistic for a small team | FAIL | 22–32 weeks realistic for 2 engineers; spec has no timeline. |
| 7 | Open questions are accounted for in the build plan | FAIL | Two open questions (framework choice, Claude integration model) are prerequisites to Phase 1 and must be resolved before any code is written. |
| 8 | Verification criteria are sufficient | PARTIAL | No automated test strategy, no CI/CD, no definition of "tests passing" beyond "Claude runs tests." |

---

### 1. Phase Ordering Verification — PASS

The four-phase sequence is correctly ordered. Phase 1 (shell) must precede Phase 2 (parallelism), which must precede Phase 3 (lifecycle state machine). Phase 4 is correctly deferred as additive polish.

**One dependency concern:** Phase 3 task "parse Claude output for task completions" assumes a PTY session model established in Phase 1. If Phase 1 uses a simpler subprocess model, Phase 3 parsing will require a rewrite. This must be made explicit in Phase 1 scope.

---

### 2. Task Completeness Per Phase — PARTIAL

**Phase 1 — Missing Tasks (HIGH RISK)**

| Missing Task | Why It Blocks |
|---|---|
| IPC architecture (main process ↔ renderer) | Electron/Tauri both require explicit IPC design for PTY data, file reads, git commands. Bolting on after the fact is a major refactor. |
| App state management choice (Redux/Zustand/etc.) | Worktree switching in Phase 2 requires reactive global state. Must be chosen and scaffolded in Phase 1. |
| Claude integration contract (CLI vs API vs Agent SDK) | Listed as a checkbox but is the single most important architectural decision in the plan. Architecturally incompatible paths. |
| Secure credential storage | Claude API key must be stored. No task covers OS keychain integration or secrets management. |
| Dev tooling / build pipeline | TypeScript, bundler, hot reload setup takes real time and is not listed. |

**Phase 2 — Missing Tasks (MEDIUM RISK)**

| Missing Task | Why It Blocks |
|---|---|
| Session persistence across restarts | Are all PTY sessions lost on app restart? Spec is silent. |
| PTY crash recovery | What happens when a Claude session dies mid-implementation? No recovery path described. |
| Worktree state hydration on open | When a user re-opens a workspace, the sidebar must reconstruct from disk. No task covers this. |

**Phase 3 — Missing Tasks (HIGH RISK)**

| Missing Task | Why It Blocks |
|---|---|
| System prompt management and versioning | Grill, Research, Implement, and Verify all require distinct system prompts. No task covers defining, testing, or version-controlling them. |
| Token budget / context window management | Research phase reads source files. Large codebases exceed context windows. Section 11 names this but no Phase 3 task resolves it. |
| Structured output contract definition | Grill scores, Research findings, Plan tasks, and Verify checklists all require Claude to return structured JSON. No task covers defining or validating this schema. |
| Malformed Claude response handling | Claude will deviate from expected structure. No task addresses graceful degradation. |

**Phase 4 — Missing Tasks (MEDIUM RISK)**

| Missing Task | Why It Blocks |
|---|---|
| Auto-update mechanism | Desktop apps require an update delivery system. Not listed. |
| Phase 4 exit condition | Phase 4 ends with a list of checkboxes and no "done" definition. |

---

### 3. Exit Criteria Evaluation — PARTIAL

| Phase | Exit Criteria | Assessment |
|---|---|---|
| Phase 1 | "Open a repo, talk to Claude, edit files, run terminal commands." | PASS — four concrete verifiable behaviors. |
| Phase 2 | "Run 3 worktrees in parallel, see all agents, switch between them." | PASS with caveat — "see all agents" needs clarification (live streaming vs. status cards). |
| Phase 3 | "A feature can go from blank brief to verified implementation." | FAIL — qualitative, not measurable. Needs 6 sub-conditions, one per lifecycle phase. |
| Phase 4 | No exit condition stated. | FAIL — missing entirely. |

---

### 4. Technical Feasibility — PARTIAL

**Items harder than they look:**

**PTY multiplexing for parallel Claude sessions (Phase 2)**
Managing N independent PTY processes, routing output to the correct UI pane, and handling per-pane resize events is a non-trivial systems problem. `node-pty` handles a single PTY well; multiplexing N requires a custom session manager. This is 2–4 weeks of work, not a single checkbox.

**Structured output parsing from Claude stdout (Phase 3)**
Parsing Claude's prose output for task completion markers is brittle — Claude's style varies. The alternative (structured tool calls via API) requires the Anthropic API directly, not the Claude Code CLI, which is an architectural divergence. This open question must be resolved before Phase 1 begins, not Phase 3.

**Grill scoring — Claude returns structured JSON (Phase 3)**
Reliable structured output requires prompt engineering, output validation, retry logic, and testing across diverse inputs. This is a prompt engineering and reliability engineering task. Estimate 1–2 weeks for a robust implementation.

**Research phase context window limits (Phase 3)**
Real codebases commonly exceed 100k+ tokens. The Research phase will silently fail on large repos without depth limits, file prioritization, and chunked summarization. This is noted in Section 11 but has no corresponding task.

**Embedded web tab (Phase 4)**
Embedding a webview for arbitrary URLs requires sandboxing, CSP policies, and navigation controls. This carries real security risk and is not a "polish" item.

**Items that are straightforward:**
Git worktree CLI wrappers, file tree from `fs`, phase track UI, propose form, keyboard shortcuts, PR creation via `gh` CLI or GitHub API.

---

### 5. Integration Risk — FAIL (Phase 1+2 boundary)

**Phase 1 + Phase 2 — HIGH RISK**

1. **PTY session ownership.** Phase 1 likely implements a single PTY manager. Phase 2 requires 1:N. If Phase 1 does not design a `SessionManager` abstraction, Phase 2 forces a rewrite. Mitigation: stub a `SessionManager` in Phase 1 even for a single session.
2. **UI state scoping.** Phase 1 likely has flat global state. Phase 2 requires all UI state (tabs, editor content, terminal scroll, Claude history) scoped per-worktree. Retrofitting this is a major refactor. Mitigation: scope all state under `activeWorktree` from day one in Phase 1.
3. **File editor tab model.** Phase 1 opens files in an editor tab. Phase 2 requires tabs to be per-worktree. A single global tab manager in Phase 1 gets rewritten in Phase 2.

**Phase 2 + Phase 3 — MODERATE RISK**

The lifecycle state machine (Phase 3) must control what an existing Claude session does. If Phase 2 lets sessions run freeform and Phase 3 tries to impose structured prompting on the same session object, there will be conflicts. Mitigation: design the Claude session interface in Phase 2 with a `mode` parameter.

**Phase 3 + Phase 4 — LOW RISK**

Phase 4 items are additive and do not touch the lifecycle state machine.

---

### 6. Scope Assessment — FAIL

No timeline estimates are in the spec. Realistic estimate for a 2-person team:

| Phase | Realistic Effort |
|---|---|
| Phase 1 — Core Shell | 6–8 weeks |
| Phase 2 — Worktree Parallelism | 4–6 weeks |
| Phase 3 — Feature Lifecycle | 8–12 weeks |
| Phase 4 — Polish & Integration | 4–6 weeks |
| **Total** | **22–32 weeks** |

Add 4–6 weeks if the team has no prior Electron/Tauri experience.

**To accelerate:** Cut Phase 4 entirely from v1 (saves 4–6 weeks). A lean v1 through Phase 3 is achievable in 18–22 weeks.

---

### 7. Open Questions Impact — FAIL

| Question | Impact | Must Resolve Before |
|---|---|---|
| Electron vs Tauri? | HIGH — affects every Phase 1 task | Phase 1 day 1 |
| How does lifecycle state persist? | HIGH — affects Phase 3 architecture | Phase 3 design kickoff |
| How to detect task completion in Implement? | CRITICAL — determines whether CLI subprocess or API is used; affects Phase 1 and Phase 3 | Phase 1 day 1 |
| How does Grill scoring work? | MEDIUM — can ship Grill without scoring initially | Before Phase 3 exit |
| Can two agents share a worktree? | LOW — spec already answers "probably not"; codify as constraint | Resolved now |
| Research phase depth limit? | HIGH — without this, Phase 3 Research fails on real codebases | Before Phase 3 implementation |
| Mobile clients? | NONE — correctly deferred | N/A |

**Critical finding:** "Electron vs Tauri" and "how to detect task completion" must be decided before any code is written. They are not design questions — they are the foundation of the entire technical architecture.

---

### 8. Missing Verification Criteria

The following should be tested but are not mentioned anywhere in the spec:

1. **PTY session isolation** — commands in worktree A's terminal must not affect worktree B.
2. **Worktree state persistence** — all worktrees restored with correct lifecycle phase and tabs after app restart.
3. **Lifecycle state machine transition table** — every valid and invalid transition (advance, retreat, skip) needs defined and tested behavior.
4. **Structured Claude output validation** — schema + fallback for every phase that depends on Claude returning JSON.
5. **Parallel agent limit enforcement** — graceful degradation when limit exceeded (no crash).
6. **Git worktree cleanup** — verify `git worktree remove` runs on archive and disk space is reclaimed.
7. **Cross-platform behavior** — which platforms are supported? macOS, Windows, Linux behavior differs for PTY and file paths.
8. **Claude credential management** — how API keys are stored and secured is a security requirement absent from the spec.

---

### Gaps Summary

| Gap | Risk | Suggestion |
|---|---|---|
| Electron vs Tauri not decided | HIGH | Decide immediately. Recommend Electron for v1 (faster iteration, better Node/PTY ecosystem). |
| Claude integration model not decided | HIGH (BLOCKER) | Most important architectural decision. Answer determines Phase 3 feasibility. |
| Phase 1 PTY layer not designed for N sessions | HIGH | Add `SessionManager` abstraction task to Phase 1. |
| Phase 1 state not scoped per-worktree | HIGH | Add "scaffold per-worktree state model" task to Phase 1. |
| Phase 3 exit criteria vague | MEDIUM | Rewrite as 6 measurable sub-conditions (one per lifecycle phase). |
| Phase 4 has no exit condition | MEDIUM | Define done: e.g., "all Phase 4 items ship, keyboard shortcuts work throughout, settings page complete." |
| No timeline | MEDIUM | Add milestone estimates to the build plan. |
| Token/context management not tasked | HIGH | Add tasks: configurable depth limit, file prioritization, context overflow handling. |
| System prompt versioning not tasked | MEDIUM | Add task: "System prompt library, per-phase, version-controlled." |
| Claude credential management not mentioned | HIGH (SECURITY) | Add to Phase 1: "Secure credential storage (OS keychain integration)." |
| No cross-platform target defined | MEDIUM | Define target platforms before Phase 1 begins. |
| No automated test strategy | MEDIUM | Add testing section: unit tests for state machine, integration tests for PTY, E2E tests for lifecycle. |

---

### Recommendation

**REQUEST_CHANGES**

The build plan has a sound logical structure and the vision is coherent and achievable. Phase ordering is correct. Phases 1 and 2 exit criteria are measurable. However, the plan is not executable in its current form because:

1. Two architectural decisions that are prerequisites to Phase 1 are still open (framework choice, Claude integration model). Writing Phase 1 code before these are resolved guarantees rework.
2. Phase 1 does not include the foundational abstractions (SessionManager, per-worktree state scoping) that Phase 2 requires — creating a forced refactor at the Phase 1→2 boundary.
3. Phase 3 contains multiple tasks significantly larger than a single checkbox, and is missing tasks for schema definition and error handling.
4. Phase 4 has no exit condition.

**Before implementation begins:**
1. Decide Electron or Tauri (recommend Electron for v1).
2. Decide Claude Code CLI vs Anthropic API vs Agent SDK.
3. Add `SessionManager` abstraction and per-worktree state scoping to Phase 1.
4. Add credential storage task to Phase 1.
5. Rewrite Phase 3 exit criteria as 6 measurable sub-conditions.
6. Add Phase 4 exit condition.
7. Add context window / token management tasks to Phase 3.
8. Add a testing strategy section.

This is a revision request, not a rejection. The core vision is sound.
