import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export interface McpLaunchSpec {
  command: string
  args: string[]
  env: Record<string, string>
}

/**
 * Build the spawn descriptor Claude Code needs to launch our stdio MCP server.
 *
 * We invoke the Electron binary itself with `ELECTRON_RUN_AS_NODE=1` so the
 * server runs under Electron's bundled Node ABI — that's the ABI `better-sqlite3`
 * was rebuilt for (via electron-rebuild). System `node` from PATH would crash
 * with NODE_MODULE_VERSION mismatch.
 *
 * - dev:      script at `<repo>/out/main/mcp-server.js`, exec at process.execPath
 * - packaged: script at `<resources>/app.asar.unpacked/out/main/mcp-server.js`,
 *             exec is the packaged Electron binary (Codrox.app/Contents/MacOS/Codrox)
 *
 * Returns null if the bundled script can't be located so callers skip writing
 * a broken `.mcp.json`.
 */
export function resolveMcpLaunchSpec(workspacePath: string): McpLaunchSpec | null {
  const scriptCandidates: string[] = app.isPackaged
    ? [join(process.resourcesPath, 'app.asar.unpacked', 'out', 'main', 'mcp-server.js')]
    : [join(app.getAppPath(), 'out', 'main', 'mcp-server.js')]

  const script = scriptCandidates.find((p) => existsSync(p))
  if (!script) return null

  return {
    command: process.execPath,
    args: [script, '--workspace', workspacePath],
    env: { ELECTRON_RUN_AS_NODE: '1' }
  }
}
