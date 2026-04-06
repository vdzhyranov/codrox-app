# Forge OS Product Spec — Comprehensive Critic Review

**Reviewer:** Critic Agent (Opus 4.6)  
**Date:** 2026-04-05  
**Artifact:** `/Applications/Development/codrox-app/codrox.md`  
**VERDICT: REVISE** — Strong vision with significant engineering underspecification and scope risks

---

## Pre-commitment Predictions

Before deep analysis, I predicted these problem areas for an "AI-native IDE with parallel agent orchestration" spec:

1. **Claude Code integration will be underspecified** — how exactly does the app control Claude Code sessions? API? CLI subprocess? What's the contract?
2. **Resource management will be hand-waved** — parallel agents means parallel LLM calls, memory, CPU, and token costs. Likely glossed over.
3. **The lifecycle will be too rigid for real use** — 6 phases sounds like waterfall for prompts; real work is messier.
4. **Electron vs Tauri decision deferral will cascade** — this isn't a detail, it's a foundation choice that affects every subsequent decision.
5. **No mention of authentication, pricing, error handling, or telemetry** — product specs for developer tools routinely omit operational concerns.

**Result:** 4 of 5 confirmed. Prediction #3 partially mitigated by the retreat mechanism, but the rigidity concern remains valid.

---

## 1. Product Perspective

### What's Compelling

The core insight is real: Claude Code has shifted the bottleneck from writing to orchestrating, and current tools don't reflect that. The "mission control" metaphor is strong and differentiated. The problem table in Section 2 is honest and well-articulated.

### What Doesn't Hold Up

**The "phases over prompts" bet is the riskiest design decision in the entire spec.** It assumes that the reason freeform prompting produces inconsistent results is *lack of structure*. The alternative hypothesis — that inconsistent results come from inconsistent *thinking* and that structure just adds friction to people who already think well — is never addressed.

The spec claims "structured lifecycle phases produce better outcomes than open-ended chat" (Design Principle #1) but provides zero evidence. This is the foundational bet of the entire product and it's stated as an axiom rather than a hypothesis. If this bet is wrong, the product is a worse Claude Code wrapper with extra steps.

**The "you review, Claude executes" model (Principle #3) assumes trust levels that don't exist yet.** In practice, developers don't trust AI-generated code enough to only review at gates. They want to watch, intervene, and course-correct mid-stream. The spec acknowledges mid-implementation interruption but treats it as an exception rather than the norm.

### Strongest Bet

Worktrees as the unit of parallelism. This is architecturally sound, maps cleanly to git's model, and solves a real problem (parallel feature development with isolation). Even if the lifecycle phases fail, the worktree orchestration layer has standalone value.

### Weakest Bet

Grill phase scoring. Having Claude score its own adversarial review on a 1-10 scale for "clarity" and "completeness" is theater. Claude will produce plausible-looking numbers that don't correlate with actual proposal quality. The spec even hedges this by saying "score thresholds are advisory, not blocking" — which means the team already suspects this won't work but is including it anyway.

---

## 2. Engineering Perspective

### Buildable as Specified?

Phase 1 (Core Shell) is buildable. Phases 2-4 have escalating underspecification that will stall the team.

### What's Overengineered

**The Grill phase scoring system.** Building prompt-engineered structured JSON scoring, rendering it, and making it advisory-only is effort spent on a feature that adds marginal value. Cut it from initial scope; replace with an unstructured adversarial conversation that the user can exit when satisfied.

**The Research phase finding taxonomy** (PATTERN, RISK, DEPENDENCY, INSIGHT). This requires Claude to classify its own findings into categories, which means prompt engineering for structured output, a rendering system for typed cards, and filtering UI. In practice, a flat list of findings with manual user triage would ship faster and work better.

### What's Underspecified

1. **Claude Code integration model.** The spec says `"Claude Code subprocess integration (PTY)"` in the build plan but never defines the contract. Is Forge OS spawning `claude` CLI processes? Is it using an SDK? How does it inject phase-specific system prompts? How does it parse structured output (task completions, scores, findings)? This is the single most important technical decision in the product and it gets one bullet point.

2. **State management.** The spec asks "JSON sidecar vs SQLite?" in Open Questions but doesn't address the harder problem: what state needs to be persisted, what's the schema, how do you handle state corruption, what happens when the user force-quits mid-implementation? Every phase transition is a state change that needs to be atomic and recoverable.

3. **Agent progress tracking.** The spec says progress bars show `"task completion % (estimated by Claude)"` — this is not an engineering plan, this is a wish. How does Claude estimate completion? Is it token-based? Task-based? Does Claude emit structured progress events? What happens when the estimate is wrong (it will be)?

4. **Error handling is completely absent.** What happens when:
   - Claude's session crashes mid-implementation?
   - A git worktree has merge conflicts with main?
   - The user's machine runs out of memory with 4 agents?
   - Claude produces code that doesn't compile?
   - The network drops during a Claude session?
   - A PTY process hangs?

   None of these are edge cases. They are the normal operating conditions of a development tool.

5. **Testing strategy in Verify phase.** The Verify phase assumes Claude can `"run unit tests for all new functions"` and `"integration tests."` How? Does the project already have a test framework? What if it doesn't? Does Claude write the tests AND run them? What test runner? How are results parsed?

### Where the Team Will Get Stuck

- **Parsing Claude's stdout for task markers** (acknowledged as an open question). This is fragile. Claude's output format isn't guaranteed. Any change to Claude Code's output formatting breaks the parser. The team will spend weeks on regex/heuristic parsing that never fully works.
- **PTY management across multiple worktrees.** Managing N concurrent pseudo-terminals, each with a Claude Code session, each scoped to a different working directory, with live output streaming to the UI — this is a significant systems programming challenge that the spec treats as a line item.
- **Phase-specific system prompts.** The spec assumes Claude's behavior can be reliably switched between "adversarial" (Grill), "investigative" (Research), and "execution" (Implement) modes. In practice, getting Claude to consistently stay in a mode across a long conversation requires careful prompt engineering and may require session resets between phases.

---

## 3. UX Perspective

### Is the Layout Sane?

The three-panel layout (sidebar + content + agent panel) is reasonable and familiar (VSCode-like with the agent panel replacing the right sidebar). The 220px left / flex center / 260-280px right proportions are sensible.

**However, the information density is too high.** The left sidebar holds: worktree list + per-worktree badges + progress bars + file tree + git changes. That's 5 distinct information types in 220px. On a 13" laptop, this will feel cramped. The spec doesn't address responsive behavior or collapsed states.

### Is 6 Phases Too Many?

**Yes, for most work.** The lifecycle makes sense for large features but is overkill for:
- Bug fixes (skip straight to Implement)
- Small refactors (Propose + Implement + Verify)
- Exploratory work (no clear proposal yet)

The spec allows phase-skipping (`"Jumping forward skips phases"`) but doesn't address the UX of this. If most real work skips 2-4 phases, the lifecycle UI is visual noise for the common case. The spec should define "lightweight mode" vs "full lifecycle" templates, or auto-suggest which phases to skip based on task complexity.

### Learning Curve

The product introduces several novel concepts simultaneously:
- Worktrees as a first-class concept (most developers don't use git worktrees)
- A 6-phase lifecycle with specific semantics per phase
- Agent orchestration with parallel execution
- Phase-specific Claude behaviors

This is a steep learning curve. The spec has no onboarding plan, no progressive disclosure strategy, and no consideration of how a new user encounters this for the first time. The first experience should probably be: open a repo, have one worktree, talk to Claude — and gradually introduce phases and parallelism.

### Keyboard Shortcuts — Conflicts

`Cmd+W` for "New Worktree" conflicts with the universal "Close Tab" shortcut on macOS. This will infuriate every user immediately. `Cmd+A` for "Assign Agent Task" conflicts with "Select All." These are not minor issues — they violate decades of platform convention.

---

## 4. Competitive Perspective

### Comparison Matrix

| Capability | Cursor | Windsurf | Zed | Warp | **Forge OS** |
|---|---|---|---|---|---|
| AI code generation | Yes | Yes | Yes | Yes (terminal) | Yes (Claude Code) |
| Multi-file edits | Yes | Yes | Partial | No | Yes |
| Parallel AI sessions | No | No | No | No | **Yes** |
| Git worktree integration | No | No | No | No | **Yes** |
| Structured AI workflow | No | No | No | No | **Yes** |
| Code editing (human) | Full IDE | Full IDE | Full IDE | Terminal | **Basic viewer** |
| Extension ecosystem | VSCode | VSCode | Custom | Plugins | **None** |
| Existing user base | Large | Growing | Growing | Large | **Zero** |

### The Moat

Forge OS's genuine differentiation is parallel agent orchestration via worktrees + structured lifecycle. Nobody else is doing this. If the "phases over prompts" bet pays off, this is a real moat.

### The Vulnerability

**Forge OS is betting against the IDE.** Cursor, Windsurf, and Zed are all adding AI *into* existing IDE workflows. Forge OS is saying "the IDE is wrong, you need mission control instead." This requires the user to give up their editor keybindings, extension ecosystem, debugging tools, and existing git workflow.

The spec's editor is "CodeMirror or Monaco" with basic file viewing and diff. That's not an IDE — it's a file viewer. Developers will need to keep their IDE open alongside Forge OS, which defeats the "no alt-tabbing" promise (Design Principle #4).

**Most likely competitive response:** Cursor adds a "parallel agents" feature within VSCode's existing extension model, giving users parallel AI execution without abandoning their editor. This would neutralize Forge OS's primary differentiator while keeping the IDE ecosystem intact.

---

## 5. Scope Perspective

### Is Phase 1 Actually Minimal?

Phase 1 includes: Electron/Tauri shell, 3-panel layout, Claude Code PTY integration, terminal tab, file editor (CodeMirror/Monaco), file tree. That's a reasonable MVP *if* the Electron vs Tauri decision is made upfront. Without that decision, Phase 1 cannot start.

**Missing from Phase 1 that will be needed immediately:** Error handling for Claude session crashes, basic state persistence (what happens when you close and reopen?), and window management (resize, minimize, full-screen).

### Is the Full Vision Achievable?

With a small team: 12-18 months for Phases 1-3, another 6 months for Phase 4. This assumes the Electron/Tauri decision is made in week 1, the Claude Code integration model is defined by week 2, and no major pivots are needed.

**Risk:** Phase 3 (Feature Lifecycle) is where the spec's ambitions outrun its technical definition. Building a state machine, prompt engineering 6 different Claude modes, parsing structured output, and building scoring/finding/task UIs is easily 60% of the total effort. The build plan lists it as one phase of four.

### What Should Be Cut

1. **Grill scoring** — replace with unstructured adversarial conversation
2. **Research finding taxonomy** — replace with flat findings list
3. **Web tab** — already deferred to Phase 4, good
4. **Multi-workspace support** — defer beyond Phase 4
5. **Agent progress percentage** — replace with simple running/done status until the output parsing problem is solved

---

## 6. Contradiction Audit

### Contradiction 1: "Nothing merges without Verify" vs Phase Skipping

Design Principle #6 states `"Nothing merges without Verify."` But Section 5 says `"You can move forward (advance) or backward (retreat) at any phase footer. Jumping forward skips phases."` Can you skip straight from Propose to the end? If so, Principle #6 is technically satisfiable but the structured lifecycle promise is optional, not enforced.

### Contradiction 2: "You review, Claude executes" vs Mid-Implementation Interruption

Design Principle #3 says `"Your time is spent at the review gates (Grill, Plan review, Verify sign-off)."` The Implement phase says `"You can interrupt at any time — the side chat is available during implementation."` These describe fundamentally different interaction models. Is the user a reviewer at gates, or an active supervisor? The spec hasn't decided.

### Contradiction 3: Single Agent Per Worktree vs Parallel Task Assignment

Section 11 says `"Can two agents share a worktree? Probably not — risk of file conflicts. One agent per worktree."` But Section 4 (Plan phase) says tasks are `"dependency-ordered — safe to implement sequentially or split across sub-agents."` What sub-agents? On what worktrees? If one agent per worktree, and the Plan has 6 tasks, they must be sequential. The "split across sub-agents" promise is unresolved.

### Contradiction 4: Editor as Tab vs "No Alt-Tabbing"

Design Principle #4 promises `"No alt-tabbing between terminal, IDE, browser, chat."` But the editor is "CodeMirror or Monaco" — a basic code viewer, not an IDE. Users who need debuggers, language servers, linting, refactoring tools, or custom keybindings will still need their IDE open. The promise and the capability don't match.

---

## 7. Blind Spots

These are topics the spec does not address that it absolutely must before implementation:

1. **Authentication and API keys.** How does Claude Code authenticate? Where are API keys stored? How are they secured?
2. **Cost visibility.** 4 parallel agents could cost $10-50/hour in tokens. Users need cost tracking, budgets, and estimates. Not mentioned once.
3. **Offline behavior.** What happens when the network drops? Are worktree states preserved? Can the user still use terminal and editor?
4. **Multi-user / team scenarios.** The header says "team alignment document" but team usage is never discussed. Can two developers share a workspace?
5. **Telemetry and analytics.** Without instrumentation, the "phases over prompts" bet can never be validated. How are phase durations, completion rates, and skip rates tracked?
6. **Security model.** Multiple Claude sessions with filesystem access. What prevents one agent from modifying files another agent is working on in shared areas (node_modules, config files, lockfiles)?
7. **Update mechanism.** How does the app update? Auto-update? Claude Code version compatibility?
8. **Accessibility.** No mention of screen reader support, keyboard-only navigation, or color-blind alternatives to the heavy color coding.
9. **Platform support.** macOS shortcuts (`Cmd+K`) mentioned but no statement on whether this is macOS-only or cross-platform.
10. **Data persistence and backup.** If lifecycle state is stored as JSON sidecars in worktree directories, what happens when a worktree is deleted via `git worktree remove`? The state is lost.

---

## 8. Strongest Aspects

1. **Worktrees as the unit of parallelism.** The single best architectural decision. Maps naturally to git, provides real isolation, solves a genuine problem. This insight alone justifies the product's existence.
2. **The problem statement is honest.** Section 2 doesn't strawman current tools. The problems listed are real and experienced by anyone using Claude Code seriously.
3. **The build plan is phased correctly.** Starting with a single-worktree shell and adding parallelism second is the right order. Not boiling the ocean in Phase 1.
4. **Retreat mechanism in the lifecycle.** Going backward through phases without erasing work shows design maturity. Many lifecycle systems are one-way traps.
5. **The spec is well-written.** Clear structure, honest open questions, readable prose. The open questions table in Section 11 shows intellectual honesty about gaps.

---

## 9. Top 5 Recommendations

### 1. Resolve the Claude Code Integration Model Before Anything Else
**Priority: CRITICAL**

The entire product depends on programmatic control of Claude Code sessions. Define the contract now:
- Is it CLI subprocess (`claude --session-id X --system-prompt Y`)?
- Is there an SDK or API?
- How are phase-specific system prompts injected?
- How is structured output (scores, findings, task status) extracted?
- What are the failure modes and how are they handled?

This is not an implementation detail. It is the product's technical foundation. Every build plan task depends on it.

### 2. Make the Lifecycle Optional and Adaptive
**Priority: HIGH**

Add a "quick mode" that is just a worktree + Claude session with no lifecycle. Let users opt into phases per-worktree. Auto-suggest phase depth based on task complexity:
- Bug fix? Propose + Implement + Verify.
- New feature? Full lifecycle.
- Exploration? No phases, just a session.

This preserves the lifecycle's value for complex work without imposing it on simple tasks.

### 3. Fix the Keyboard Shortcuts
**Priority: HIGH**

`Cmd+W` (New Worktree) and `Cmd+A` (Assign Agent) conflict with macOS system shortcuts (Close Tab and Select All). Remap:
- New Worktree: `Cmd+Shift+W` or `Cmd+Shift+N`
- Assign Agent: `Cmd+Shift+A`
- Audit all shortcuts against macOS and VSCode conventions before shipping.

### 4. Cut Grill Scoring and Research Taxonomies from Initial Scope
**Priority: MEDIUM**

These add significant implementation complexity without proven value. Replace with:
- Grill: unstructured adversarial conversation, user decides when to exit
- Research: flat list of findings, user manually tags important ones

Re-add structured scoring/taxonomy after validating user demand.

### 5. Add a Cost and Resource Management Section
**Priority: HIGH**

Parallel Claude sessions are expensive. The spec must address:
- Estimated token costs per phase, per agent
- User-visible cost tracking in the UI
- Budget limits and agent caps
- Resource monitoring (CPU, memory, token usage)
- Graceful degradation when limits are hit

Without this, users will run 4 agents, get a large API bill, and churn immediately.

---

## Verdict Justification

**REVISE** because the vision is sound but the spec is not yet actionable. The Claude Code integration model — the product's technical foundation — is undefined. Error handling, authentication, cost management, and state persistence are absent. Four internal contradictions need resolution. The lifecycle needs an adaptive/lightweight mode.

What would earn ACCEPT: resolve the Claude Code integration contract, address the 4 contradictions, add error handling and cost visibility sections, make the lifecycle adaptive, fix the keyboard shortcuts.
