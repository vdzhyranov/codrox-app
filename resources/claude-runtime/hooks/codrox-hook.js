#!/usr/bin/env node
/*
 * Codrox observability hook bridge.
 *
 * Claude Code invokes this script for PreToolUse / PostToolUse / UserPromptSubmit /
 * Stop / SubagentStop hooks (configured in the workspace's .claude/settings.json).
 * Stdin contains the hook event JSON. We POST it to the local Codrox IPC server
 * (CODROX_HOOK_URL) so the Electron main process can update the agent tracker,
 * research log, KG, and UI state.
 *
 * Required env (injected by ClaudeEnvManager):
 *   CODROX_HOOK_URL   absolute http URL of the Codrox hook listener
 *   CODROX_WORKSPACE  workspace id this PTY belongs to
 *   CODROX_HOOK_EVENT one of: PreToolUse|PostToolUse|UserPromptSubmit|Stop|SubagentStop
 *
 * Failure mode: silent no-op. We never block Claude on hook failure.
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')

function readStdin() {
  return new Promise((resolve) => {
    let buf = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => { buf += chunk })
    process.stdin.on('end', () => resolve(buf))
    process.stdin.on('error', () => resolve(buf))
    setTimeout(() => resolve(buf), 1500)
  })
}

async function main() {
  const url = process.env.CODROX_HOOK_URL
  const workspace = process.env.CODROX_WORKSPACE
  const event = process.env.CODROX_HOOK_EVENT
  if (!url || !workspace || !event) return

  const body = await readStdin()
  let parsed = null
  try { parsed = body ? JSON.parse(body) : null } catch { parsed = { raw: body } }

  const payload = JSON.stringify({
    workspace,
    event,
    at: Date.now(),
    pid: process.pid,
    cwd: process.cwd(),
    payload: parsed,
  })

  let target
  try { target = new URL(url) } catch { return }
  const lib = target.protocol === 'https:' ? https : http
  const req = lib.request({
    method: 'POST',
    host: target.hostname,
    port: target.port,
    path: target.pathname || '/',
    headers: {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    },
    timeout: 750,
  })
  req.on('error', () => {})
  req.on('timeout', () => req.destroy())
  req.write(payload)
  req.end()
}

main().catch(() => {})
