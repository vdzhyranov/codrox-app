# Contributing to Codrox

Thank you for your interest in contributing to Codrox! We welcome contributions from developers of all skill levels. This guide will help you get started.

## What is Codrox?

Codrox is an AI-native development environment built with Electron, React 19, and TypeScript. It integrates with Claude for intelligent code assistance, Git tooling, PTY management, and workspace coordination—all from a modern desktop interface.

## How to Contribute

We accept contributions in many forms:

- **Bug reports**: File an issue describing the problem and steps to reproduce
- **Feature requests**: Share ideas for new functionality
- **Code improvements**: Submit pull requests with bug fixes or features
- **Documentation**: Help improve guides and inline documentation
- **Testing**: Report edge cases and platform-specific issues

## Development Setup

### Prerequisites

- Node.js 18+ and npm 9+
- Git

### Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/codrox.git
   cd codrox
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Rebuild native modules** (required for electron-rebuild):
   ```bash
   npm install
   ```
   Native modules (`node-pty`, `better-sqlite3`) are automatically rebuilt via the postinstall script.

4. **Start development mode**:
   ```bash
   npm run dev
   ```
   This launches the Electron app with live reload.

5. **Build for production**:
   ```bash
   npm run build
   ```

6. **Run tests**:
   ```bash
   npm run test
   ```

## Code Style & Patterns

### TypeScript

- Use **strict mode** (`"strict": true` in tsconfig.json)
- Write type-safe code; avoid `any` unless necessary
- Prefer explicit types over inference for function parameters and return values

### React Components

- Write **functional components** only (no class components)
- Use **React 19** hooks and features
- Keep components focused and composable
- Prefer `const` declarations

### Zustand State Management

**CRITICAL RULE**: In Zustand selectors, **never use getters or method calls**. Always select raw state slices and derive in the component body.

✅ **Correct**:
```typescript
// Store definition
const useAppStore = create((set) => ({
  items: [],
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
}));

// Component
function MyComponent() {
  const items = useAppStore((s) => s.items); // Raw state slice
  const itemCount = items.length; // Derive in component
  return <div>{itemCount}</div>;
}
```

❌ **Incorrect** (causes infinite renders):
```typescript
// DON'T DO THIS - method calls in selectors create new refs
const itemCount = useAppStore((s) => s.getItemCount()); // ⚠️ Bad!
```

### Styling

- Use **CSS custom variables** for theming (`--bg`, `--surface`, `--accent`, etc.)
- Inline styles with custom variables where appropriate
- Font stack: Geist Mono and Syne (imported in app)

### Project Structure

```
src/
├── main/              # Electron main process
│   ├── ipc/          # IPC handler definitions
│   │   ├── browser.ipc.ts
│   │   ├── filesystem.ipc.ts
│   │   ├── git.ipc.ts
│   │   ├── pty.ipc.ts
│   │   ├── subagents.ipc.ts
│   │   └── workspace.ipc.ts
│   └── services/     # Node.js services
│       ├── FileWatcher.ts
│       ├── GitService.ts
│       ├── PTYManager.ts
│       ├── PersistenceService.ts
│       ├── SubAgentWatcher.ts
│       └── WorkspaceSetup.ts
├── preload/           # Electron preload bridge
│   └── index.ts      # Typed IPC exposure
├── renderer/          # React UI
│   ├── components/   # React components
│   ├── stores/       # Zustand stores
│   ├── hooks/        # Custom hooks
│   ├── layout/       # Layout components
│   └── tabs/         # Tab management
└── shared/            # Shared TypeScript types
    ├── filesystem.ts
    ├── git.ts
    ├── ipc.ts
    ├── linear.ts
    ├── tabs.ts
    └── workspace.ts
```

## Branch Naming Conventions

Use conventional prefixes for branches:

- `feat/description` — New features
- `fix/description` — Bug fixes
- `refactor/description` — Code refactoring
- `task-XXXX` — Worktree-based development branches

Examples:
- `feat/claude-streaming`
- `fix/git-push-race-condition`
- `refactor/zustand-v5-migration`
- `task-si4um` (worktree branch)

## Commit Message Format

Follow **conventional commits**:

```
<type>: <subject>

<optional body>
<optional footer>
```

**Types**: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`

**Examples**:
```
feat: add Claude streaming to editor panel

Implements WebSocket-based streaming for Claude requests in the editor,
with buffered token handling and error recovery.

fix: resolve infinite render loop in workspace store selector

Zustand selector was calling getWorkspaces() method, creating new refs
on each render. Changed to select raw state and derive in component.

chore: bump version to 0.1.18

docs: update Zustand patterns in CONTRIBUTING.md
```

## Pull Request Process

1. **Create a branch** from `main` using naming conventions above
2. **Make focused changes** — one feature or fix per PR
3. **Write tests** for new functionality (run `npm run test`)
4. **Keep commits atomic** — each commit should compile and pass tests
5. **Push and open a PR** with:
   - Clear title summarizing the change
   - Description of what changed and why
   - Link to related issues if applicable
   - Screenshots for UI changes
6. **Respond to feedback** and iterate
7. **Merge** after approval

## Code Review Expectations

- Reviews focus on correctness, performance, and maintainability
- Consider the Zustand patterns and state management—reviewers will check for selector misuse
- Mention if native modules were affected (triggers rebuild concern)
- Native module changes should note `npx electron-rebuild` requirement

## Known Quirks & Gotchas

### Electron Rebuild

After `npm install`, native modules (`node-pty`, `better-sqlite3`) require rebuilding for the Electron runtime. This is **handled automatically** via postinstall, but if you encounter module load errors:

```bash
npx electron-rebuild
```

### Claude PTY Startup

There's a known ~2-second delay when spawning a Claude PTY session. This is due to model initialization. Work around it by:
- Pre-spawning PTY instances in development
- Adding user-facing feedback ("Claude is starting...")
- Filing issues if the delay increases unexpectedly

### Testing

Run tests with:
```bash
npm run test
```

Use `vitest` syntax. Tests should be colocated with source files as `.test.ts(x)`.

## Questions or Need Help?

- **Issues**: File a GitHub issue with details and reproduction steps
- **Discussions**: Use GitHub Discussions for questions and proposals
- **Documentation**: Check CLAUDE.md in the project root for internal guidelines

---

Thanks for contributing to Codrox! 🚀
