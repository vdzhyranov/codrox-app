import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import { resolveMcpLaunchSpec } from './graph/mcpPath'

export interface ProjectInfo {
  name: string
  description: string
  techStack: string[]
  buildCommands: string[]
}

export class WorkspaceSetup {
  async setupWorkspace(workspacePath: string): Promise<void> {
    // Create .claude/ directory if it doesn't exist
    const claudeDir = join(workspacePath, '.claude')
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true })
    }

    // Only create CLAUDE.md if it doesn't already exist
    const claudeMdPath = join(workspacePath, 'CLAUDE.md')
    if (!existsSync(claudeMdPath)) {
      const info = await this.detectProjectInfo(workspacePath)
      const content = this.generateClaudeMd(info)
      writeFileSync(claudeMdPath, content, 'utf-8')
    }

    // Wire Claude Code → codrox-graph MCP server (per-workspace).
    this.writeMcpConfig(workspacePath)
  }

  private writeMcpConfig(workspacePath: string): void {
    const spec = resolveMcpLaunchSpec(workspacePath)
    if (!spec) return // bundled script not available — skip silently in tests/dev edge cases

    const mcpJsonPath = join(workspacePath, '.claude', '.mcp.json')
    const desired = {
      mcpServers: {
        'codrox-graph': {
          command: spec.command,
          args: spec.args,
          env: spec.env
        }
      }
    }

    // Merge with any existing .mcp.json so we don't clobber user-added servers.
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

  async detectProjectInfo(workspacePath: string): Promise<ProjectInfo> {
    const name = this.detectName(workspacePath)
    const description = this.detectDescription(workspacePath)
    const techStack = this.detectTechStack(workspacePath)
    const buildCommands = this.detectBuildCommands(workspacePath)

    return { name, description, techStack, buildCommands }
  }

  private detectName(workspacePath: string): string {
    const pkgPath = join(workspacePath, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.name) return pkg.name
      } catch {
        // ignore
      }
    }
    return basename(workspacePath)
  }

  private detectDescription(workspacePath: string): string {
    const pkgPath = join(workspacePath, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.description) return pkg.description
      } catch {
        // ignore
      }
    }
    return 'A software project'
  }

  private detectTechStack(workspacePath: string): string[] {
    const stack: string[] = []

    if (existsSync(join(workspacePath, 'package.json'))) {
      try {
        const pkg = JSON.parse(readFileSync(join(workspacePath, 'package.json'), 'utf-8'))
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }

        if (deps['typescript'] || existsSync(join(workspacePath, 'tsconfig.json'))) {
          stack.push('TypeScript')
        } else {
          stack.push('JavaScript')
        }

        if (deps['react']) stack.push('React')
        if (deps['vue']) stack.push('Vue')
        if (deps['svelte']) stack.push('Svelte')
        if (deps['next']) stack.push('Next.js')
        if (deps['nuxt']) stack.push('Nuxt')
        if (deps['electron']) stack.push('Electron')
        if (deps['express'] || deps['fastify'] || deps['koa']) stack.push('Node.js server')
        if (deps['vite']) stack.push('Vite')
        if (deps['webpack']) stack.push('Webpack')
        if (deps['jest'] || deps['vitest']) stack.push('Testing')
      } catch {
        // ignore
      }
    }

    if (existsSync(join(workspacePath, 'Cargo.toml'))) {
      stack.push('Rust')
    }

    if (existsSync(join(workspacePath, 'go.mod'))) {
      stack.push('Go')
    }

    if (existsSync(join(workspacePath, 'requirements.txt')) || existsSync(join(workspacePath, 'pyproject.toml'))) {
      stack.push('Python')
    }

    if (existsSync(join(workspacePath, 'Gemfile'))) {
      stack.push('Ruby')
    }

    if (existsSync(join(workspacePath, 'pom.xml')) || existsSync(join(workspacePath, 'build.gradle'))) {
      stack.push('Java/JVM')
    }

    if (stack.length === 0) {
      stack.push('Unknown')
    }

    return stack
  }

  private detectBuildCommands(workspacePath: string): string[] {
    const commands: string[] = []

    const pkgPath = join(workspacePath, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        const scripts = pkg.scripts ?? {}
        if (scripts.dev) commands.push(`npm run dev`)
        if (scripts.build) commands.push(`npm run build`)
        if (scripts.test) commands.push(`npm run test`)
        if (scripts.lint) commands.push(`npm run lint`)
      } catch {
        // ignore
      }
    }

    if (existsSync(join(workspacePath, 'Cargo.toml'))) {
      commands.push('cargo build', 'cargo test')
    }

    if (existsSync(join(workspacePath, 'go.mod'))) {
      commands.push('go build ./...', 'go test ./...')
    }

    if (existsSync(join(workspacePath, 'Makefile'))) {
      commands.push('make')
    }

    return commands
  }

  private generateClaudeMd(info: ProjectInfo): string {
    const techList = info.techStack.map((t) => `- ${t}`).join('\n')
    const cmdList = info.buildCommands.length > 0
      ? info.buildCommands.map((c) => `- \`${c}\``).join('\n')
      : '- (no build commands detected)'

    return `# ${info.name}

## Project Overview
${info.description}

## Tech Stack
${techList}

## Development
${cmdList}

## Guidelines
- Follow existing code patterns
- Write tests for new functionality
- Keep commits atomic
`
  }

  readClaudeMd(workspacePath: string): string | null {
    const claudeMdPath = join(workspacePath, 'CLAUDE.md')
    if (!existsSync(claudeMdPath)) return null
    try {
      return readFileSync(claudeMdPath, 'utf-8')
    } catch {
      return null
    }
  }

  writeClaudeMd(workspacePath: string, content: string): void {
    const claudeMdPath = join(workspacePath, 'CLAUDE.md')
    writeFileSync(claudeMdPath, content, 'utf-8')
  }
}

export const workspaceSetup = new WorkspaceSetup()
