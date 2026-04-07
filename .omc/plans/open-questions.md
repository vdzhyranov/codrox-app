## MVP Build Plan (Phase 1) - 2026-04-05

- [ ] Claude Code CLI binary path resolution -- should we hardcode `claude`, check PATH, or allow user config? Affects Task 5.2 error handling.
- [ ] Tailwind CSS 4 vs 3 -- Tailwind v4 uses CSS-first config which is simpler but newer. If executor hits issues, falling back to v3 with `tailwind.config.js` is acceptable.
- [ ] electron-trpc vs hand-rolled typed IPC -- electron-trpc adds a dependency but gives automatic type safety. Hand-rolled is lighter but more boilerplate. Executor should pick based on complexity encountered in Task 1.2.
- [ ] xterm.js WebGL vs Canvas addon -- WebGL is faster but may have compatibility issues in some Electron/GPU combos. Task 5.1 should implement with WebGL + canvas fallback.
- [ ] Editor read-write vs read-only during active Claude session -- spec is ambiguous. Plan assumes read-write always. If this causes conflicts with Claude editing the same file, may need a lock indicator in Phase 2.
- [ ] File tree virtualization library -- for large repos (1000+ visible nodes), need windowing. Options: `@tanstack/react-virtual`, `react-window`, or custom. Executor picks in Task 4.1.
- [ ] `.forge/` directory convention -- plan uses `.forge/state.json` for per-worktree persistence. Should this be `.forge-os/` to avoid conflicts with other tools? Low risk but worth noting.
- [ ] Minimum window size -- plan specifies 1280x720. Confirm this works for the three-panel layout at the specified widths (220 + flex + 260 = needs ~1000px minimum horizontal).

### From Analyst Report (01)

- [ ] Phase Chat vs Claude Tab session architecture -- deferred to Phase 2+, but the decision (one session or two per worktree) affects resource planning.
- [ ] Lifecycle phase exit conditions: enforced (blocking) or advisory? -- deferred to Phase 3, but must be decided before lifecycle implementation begins.
- [ ] Agent crash recovery strategy -- deferred to Phase 2, but PTYManager in Phase 1 should log crash events for future use.

### From Verifier Report (04)

- [ ] Cross-platform target -- plan is macOS-first. Windows/Linux support deferred but path handling in filesystem service should use `path.join`/`path.resolve` (not hardcoded `/`) from day 1.
- [ ] Automated test strategy for CI -- plan includes tests but no CI pipeline. Should be added before Phase 2 begins.
