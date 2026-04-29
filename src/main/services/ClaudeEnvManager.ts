import { app } from 'electron'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  lstatSync,
  unlinkSync
} from 'fs'
import { join, dirname } from 'path'
import { resolveMcpLaunchSpec } from './graph/mcpPath'

/**
 * ClaudeEnvManager owns the per-workspace Claude config directory that Codrox
 * injects via CLAUDE_CONFIG_DIR. This isolates auth, conversation history, MCP
 * config, and project memory across workspaces while giving Codrox a clean
 * surface to inject skills, commands, agents, and hooks.
 *
 * Layout under <userData>/codrox/:
 *   runtime/global/{skills,agents,commands,hooks}/   — bundled, app-managed
 *   runtime/version                                  — last materialized runtime version
 *   workspaces/<id>/.claude/                         — per-workspace Claude config
 */

const HOOK_EVENTS = ['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Stop', 'SubagentStop'] as const
type HookEvent = (typeof HOOK_EVENTS)[number]

interface MaterializedWorkspace {
  claudeDir: string
}

class ClaudeEnvManager {
  private hookListenerUrl: string | null = null

  setHookListenerUrl(url: string | null): void {
    this.hookListenerUrl = url
  }

  /** Base directory: <userData>/codrox */
  private baseDir(): string {
    return join(app.getPath('userData'), 'codrox')
  }

  /** App-managed runtime that every workspace symlinks into. */
  globalRuntimeDir(): string {
    return join(this.baseDir(), 'runtime', 'global')
  }

  workspaceDir(workspaceId: string): string {
    return join(this.baseDir(), 'workspaces', workspaceId)
  }

  claudeDir(workspaceId: string): string {
    return join(this.workspaceDir(workspaceId), '.claude')
  }

  /**
   * Resolve the source directory that ships with the app bundle. In dev this is
   * the repo's resources/claude-runtime; in a packaged app it lives next to the
   * .app under process.resourcesPath/claude-runtime (see package.json
   * build.extraResources).
   */
  private bundledRuntimeSource(): string {
    const candidates = [
      // Packaged app: extraResources copies resources/claude-runtime → resourcesPath
      join(process.resourcesPath || '', 'claude-runtime'),
      // electron-vite dev: __dirname is out/main, repo root is two up
      join(__dirname, '..', '..', 'resources', 'claude-runtime'),
      // Fallback: app root
      join(app.getAppPath(), 'resources', 'claude-runtime')
    ]
    for (const c of candidates) {
      if (c && existsSync(c)) return c
    }
    return candidates[0]
  }

  /**
   * Refresh the global runtime cache if the bundled version differs from the
   * cached one. Idempotent. Safe to call on every app start.
   */
  bumpRuntimeIfStale(): void {
    const source = this.bundledRuntimeSource()
    if (!existsSync(source)) {
      console.warn('[ClaudeEnvManager] bundled claude-runtime not found at', source)
      return
    }

    const sourceVersionPath = join(source, 'version')
    const sourceVersion = existsSync(sourceVersionPath)
      ? readFileSync(sourceVersionPath, 'utf-8').trim()
      : '0'

    const target = this.globalRuntimeDir()
    const targetVersionPath = join(this.baseDir(), 'runtime', 'version')
    const targetVersion = existsSync(targetVersionPath)
      ? readFileSync(targetVersionPath, 'utf-8').trim()
      : null

    if (targetVersion === sourceVersion && existsSync(target)) {
      return
    }

    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true })
    }
    mkdirSync(dirname(target), { recursive: true })
    cpSync(source, target, { recursive: true, force: true, dereference: true })
    writeFileSync(targetVersionPath, sourceVersion, 'utf-8')
    console.log(`[ClaudeEnvManager] refreshed global runtime → version ${sourceVersion}`)
  }

  /**
   * Idempotently build the per-workspace .claude directory. Codrox-owned skills/
   * agents/commands are exposed via symlinks so app updates flow through
   * automatically. User-added content lives under skills/user, etc., and is
   * never touched.
   */
  materializeWorkspace(workspaceId: string, workspacePath?: string): MaterializedWorkspace {
    const claudeDir = this.claudeDir(workspaceId)

    mkdirSync(claudeDir, { recursive: true })
    mkdirSync(join(claudeDir, 'projects'), { recursive: true })
    mkdirSync(join(claudeDir, 'todos'), { recursive: true })
    mkdirSync(join(claudeDir, 'statsig'), { recursive: true })

    // Codrox-managed namespaces
    for (const kind of ['skills', 'agents', 'commands'] as const) {
      const dir = join(claudeDir, kind)
      mkdirSync(dir, { recursive: true })
      mkdirSync(join(dir, 'user'), { recursive: true })
      this.refreshSymlink(
        join(dir, 'codrox'),
        join(this.globalRuntimeDir(), kind)
      )
    }

    this.writeSettings(workspaceId, claudeDir)

    if (workspacePath) {
      this.writeMcpConfig(claudeDir, workspacePath)
    }

    return { claudeDir }
  }

  /** @deprecated Use materializeWorkspace */
  materializeWorkspaceHome(workspaceId: string, workspacePath?: string): MaterializedWorkspace {
    return this.materializeWorkspace(workspaceId, workspacePath)
  }

  /**
   * Environment variables to inject into every PTY spawned for a workspace.
   * CLAUDE_CONFIG_DIR redirects Claude's config away from ~/.claude so each
   * workspace has its own isolated history, settings, and MCP config.
   */
  getEnvForWorkspace(workspaceId: string): Record<string, string> {
    const env: Record<string, string> = {
      CLAUDE_CONFIG_DIR: this.claudeDir(workspaceId),
      CODROX_WORKSPACE: workspaceId,
      CODROX_RUNTIME_DIR: this.globalRuntimeDir()
    }
    if (this.hookListenerUrl) {
      env.CODROX_HOOK_URL = this.hookListenerUrl
    }
    return env
  }

  /** Best-effort cleanup when a workspace is removed. */
  destroyWorkspaceHome(workspaceId: string): void {
    const dir = this.workspaceDir(workspaceId)
    if (!existsSync(dir)) return
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch (err) {
      console.warn('[ClaudeEnvManager] failed to remove workspace dir', dir, err)
    }
  }

  // ---- internals ----------------------------------------------------------

  private writeSettings(workspaceId: string, claudeDir: string): void {
    const hookScript = join(this.globalRuntimeDir(), 'hooks', 'codrox-hook.js')
    const hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ type: string; command: string }> }>> = {}
    if (existsSync(hookScript)) {
      for (const event of HOOK_EVENTS) {
        const command = this.buildHookCommand(hookScript, event, workspaceId)
        hooks[event] = [
          {
            hooks: [{ type: 'command', command }]
          }
        ]
      }
    }

    const settings = {
      $codrox: {
        managed: true,
        workspaceId,
        runtimeDir: this.globalRuntimeDir(),
        generatedAt: new Date().toISOString()
      },
      hooks
    }

    writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify(settings, null, 2), 'utf-8')
  }

  private buildHookCommand(scriptPath: string, event: HookEvent, workspaceId: string): string {
    const script = scriptPath.replace(/'/g, "'\\''")
    const ws = workspaceId.replace(/'/g, "'\\''")
    return `CODROX_HOOK_EVENT=${event} CODROX_WORKSPACE='${ws}' node '${script}'`
  }

  private writeMcpConfig(claudeDir: string, workspacePath: string): void {
    const spec = resolveMcpLaunchSpec(workspacePath)
    if (!spec) return

    const mcpJsonPath = join(claudeDir, '.mcp.json')
    const desired = {
      mcpServers: {
        'codrox-graph': {
          command: spec.command,
          args: spec.args,
          env: spec.env
        }
      }
    }

    let existing: { mcpServers?: Record<string, unknown> } = {}
    if (existsSync(mcpJsonPath)) {
      try {
        existing = JSON.parse(readFileSync(mcpJsonPath, 'utf-8')) as typeof existing
      } catch {
        existing = {}
      }
    }
    const merged = {
      ...existing,
      mcpServers: {
        ...(existing.mcpServers ?? {}),
        ...desired.mcpServers
      }
    }
    writeFileSync(mcpJsonPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')
  }

  private refreshSymlink(linkPath: string, targetPath: string): void {
    try {
      if (existsSync(linkPath) || this.isLink(linkPath)) {
        unlinkSync(linkPath)
      }
    } catch {
      // ignore
    }
    if (!existsSync(targetPath)) return
    try {
      symlinkSync(targetPath, linkPath, 'dir')
    } catch (err) {
      console.warn('[ClaudeEnvManager] symlink failed', linkPath, '→', targetPath, err)
    }
  }

  private isLink(p: string): boolean {
    try {
      return lstatSync(p).isSymbolicLink()
    } catch {
      return false
    }
  }
}

export const claudeEnvManager = new ClaudeEnvManager()
