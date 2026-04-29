# Codrox Claude Runtime

Bundled Claude Code resources that Codrox materializes into each workspace's
fake `$HOME` (under `<userData>/codrox/runtime/global/`).

Layout:

- `skills/`   — codrox-shipped skills available in every workspace
- `agents/`   — codrox agent definitions
- `commands/` — codrox slash commands (e.g. `/codrox-status`)
- `hooks/`    — observability scripts invoked by Claude Code hooks
- `version`   — bumped when contents change so ClaudeEnvManager refreshes the cache

Do not edit the materialized copies under `<userData>` directly — they are
overwritten on each app update. Edit here and ship a new release.
