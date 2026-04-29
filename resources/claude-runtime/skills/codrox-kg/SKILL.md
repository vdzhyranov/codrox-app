---
name: codrox-kg
description: Query the per-workspace knowledge graph maintained by Codrox — files, symbols, recent git activity, agents, and concepts scoped to the current workspace.
---

# codrox-kg

Codrox maintains a knowledge graph for each workspace covering files, symbols,
recent git activity, sub-agents, and concepts. Use it whenever you need oriented
context about the current workspace before searching the filesystem or asking
the user.

## When to use

- The user asks "where is X" / "what touches X" / "who edited X recently".
- You need a fast structural overview before grepping.
- You want to cross-reference a symbol with its callers without reading every file.

## How to query

The graph is exposed through the `codrox-kg` MCP server (registered automatically
in this workspace). Available tools:

- `kg.search(q)` — fuzzy search across files, symbols, and concepts.
- `kg.neighbors(nodeId, relation?)` — graph neighbors of a node.
- `kg.stats()` — node/edge counts and last index time.

Always prefer `kg.search` over a raw Grep when the user's intent is "find X"
rather than "find the literal string X".
