import { readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync } from 'fs'
import { persistenceService } from './PersistenceService'
import type {
  LinearUser,
  LinearTeam,
  LinearTask,
  LinearAuthState,
  CreateTaskInput
} from '@shared/types/linear'

const GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql'
const ENV_KEY = 'CODROX_LINEAR_API_KEY'
const EXPORT_LINE_PREFIX = `export ${ENV_KEY}=`

class LinearService {
  private cachedUser: LinearUser | null = null

  private get apiKey(): string | null {
    return process.env[ENV_KEY] || null
  }

  // ─── Auth ────────────────────────────────────────────────

  async getAuthStatus(): Promise<LinearAuthState> {
    if (!this.apiKey) {
      this.cachedUser = null
      return { isAuthenticated: false, user: null }
    }
    try {
      if (!this.cachedUser) {
        this.cachedUser = await this.getCurrentUser()
      }
      return { isAuthenticated: true, user: this.cachedUser }
    } catch {
      this.cachedUser = null
      return { isAuthenticated: false, user: null }
    }
  }

  async setup(apiKey: string): Promise<{ success: boolean; user: LinearUser }> {
    // Validate key first
    process.env[ENV_KEY] = apiKey
    try {
      const user = await this.getCurrentUser()
      this.cachedUser = user
      // Persist to shell profile
      await this.writeToShellProfile(apiKey)
      return { success: true, user }
    } catch (err) {
      delete process.env[ENV_KEY]
      this.cachedUser = null
      throw new Error(
        err instanceof Error ? err.message : 'Invalid API key'
      )
    }
  }

  async disconnect(): Promise<void> {
    await this.removeFromShellProfile()
    delete process.env[ENV_KEY]
    this.cachedUser = null
  }

  // ─── Shell profile helpers ──────────────────────────────

  private getShellProfilePath(): string {
    const home = homedir()
    const shell = process.env.SHELL || '/bin/zsh'
    if (shell.includes('zsh')) return join(home, '.zshrc')
    if (shell.includes('bash')) {
      // macOS uses .bash_profile, Linux uses .bashrc
      const profile = join(home, '.bash_profile')
      if (existsSync(profile)) return profile
      return join(home, '.bashrc')
    }
    return join(home, '.profile')
  }

  private async writeToShellProfile(apiKey: string): Promise<void> {
    const rcPath = this.getShellProfilePath()
    const exportLine = `${EXPORT_LINE_PREFIX}"${apiKey}"`
    let content = ''
    try {
      content = await readFile(rcPath, 'utf-8')
    } catch {
      // File doesn't exist yet — that's fine
    }

    // Replace existing line or append
    const lines = content.split('\n')
    const idx = lines.findIndex((l) => l.startsWith(EXPORT_LINE_PREFIX))
    if (idx !== -1) {
      lines[idx] = exportLine
    } else {
      // Add with a comment for clarity
      if (content.length > 0 && !content.endsWith('\n')) lines.push('')
      lines.push('# Codrox — Linear integration')
      lines.push(exportLine)
    }
    await writeFile(rcPath, lines.join('\n'))
  }

  private async removeFromShellProfile(): Promise<void> {
    const rcPath = this.getShellProfilePath()
    let content: string
    try {
      content = await readFile(rcPath, 'utf-8')
    } catch {
      return
    }
    const lines = content.split('\n').filter(
      (l) => !l.startsWith(EXPORT_LINE_PREFIX) && l !== '# Codrox — Linear integration'
    )
    await writeFile(rcPath, lines.join('\n'))
  }

  // ─── GraphQL helpers ─────────────────────────────────────

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    if (!this.apiKey) throw new Error('Not authenticated with Linear')

    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.apiKey
      },
      body: JSON.stringify({ query, variables })
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Linear API error (${res.status}): ${text}`)
    }

    const json = (await res.json()) as { data: T; errors?: Array<{ message: string }> }
    if (json.errors?.length) {
      throw new Error(`Linear GraphQL error: ${json.errors[0].message}`)
    }
    return json.data
  }

  // ─── API methods ─────────────────────────────────────────

  async getCurrentUser(): Promise<LinearUser> {
    const data = await this.graphql<{
      viewer: { id: string; name: string; email: string; displayName: string }
    }>(`
      query {
        viewer {
          id
          name
          email
          displayName
        }
      }
    `)
    return data.viewer
  }

  async fetchTasks(teamId?: string): Promise<LinearTask[]> {
    const filter = teamId
      ? `filter: { assignee: { isMe: { eq: true } }, team: { id: { eq: "${teamId}" } }, state: { type: { nin: ["completed", "cancelled"] } } }`
      : `filter: { assignee: { isMe: { eq: true } }, state: { type: { nin: ["completed", "cancelled"] } } }`

    const data = await this.graphql<{
      issues: {
        nodes: Array<{
          id: string
          identifier: string
          title: string
          description: string | null
          state: { name: string; color: string; type: string }
          priority: number
          branchName: string
          url: string
          team: { id: string }
          createdAt: string
          updatedAt: string
          labels: { nodes: Array<{ name: string; color: string }> }
        }>
      }
    }>(`
      query {
        issues(${filter}, first: 50, orderBy: updatedAt) {
          nodes {
            id
            identifier
            title
            description
            state { name color type }
            priority
            branchName
            url
            team { id }
            createdAt
            updatedAt
            labels { nodes { name color } }
          }
        }
      }
    `)

    return data.issues.nodes.map((node) => ({
      id: node.id,
      identifier: node.identifier,
      title: node.title,
      description: node.description,
      state: node.state,
      priority: node.priority,
      branchName: node.branchName,
      url: node.url,
      teamId: node.team.id,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      labels: node.labels.nodes
    }))
  }

  async createTask(input: CreateTaskInput): Promise<LinearTask> {
    const variables: Record<string, unknown> = {
      title: input.title,
      teamId: input.teamId
    }
    if (input.description) variables.description = input.description
    if (input.priority !== undefined) variables.priority = input.priority

    const data = await this.graphql<{
      issueCreate: {
        success: boolean
        issue: {
          id: string
          identifier: string
          title: string
          description: string | null
          state: { name: string; color: string; type: string }
          priority: number
          branchName: string
          url: string
          team: { id: string }
          createdAt: string
          updatedAt: string
          labels: { nodes: Array<{ name: string; color: string }> }
        }
      }
    }>(`
      mutation($title: String!, $teamId: String!, $description: String, $priority: Int) {
        issueCreate(input: { title: $title, teamId: $teamId, description: $description, priority: $priority }) {
          success
          issue {
            id
            identifier
            title
            description
            state { name color type }
            priority
            branchName
            url
            team { id }
            createdAt
            updatedAt
            labels { nodes { name color } }
          }
        }
      }
    `, variables)

    const node = data.issueCreate.issue
    return {
      id: node.id,
      identifier: node.identifier,
      title: node.title,
      description: node.description,
      state: node.state,
      priority: node.priority,
      branchName: node.branchName,
      url: node.url,
      teamId: node.team.id,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      labels: node.labels.nodes
    }
  }

  async getTeams(): Promise<LinearTeam[]> {
    const data = await this.graphql<{
      teams: { nodes: Array<{ id: string; name: string; key: string }> }
    }>(`
      query {
        teams {
          nodes { id name key }
        }
      }
    `)
    return data.teams.nodes
  }

  async getBranchName(taskId: string): Promise<string> {
    const data = await this.graphql<{
      issue: { branchName: string; identifier: string; title: string }
    }>(`
      query($id: String!) {
        issue(id: $id) {
          branchName
          identifier
          title
        }
      }
    `, { id: taskId })

    if (data.issue.branchName) return data.issue.branchName

    const slug = data.issue.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
    return `${data.issue.identifier.toLowerCase()}-${slug}`
  }

  // ─── Worktree-task links ─────────────────────────────────

  linkWorktree(worktreePath: string, taskId: string, taskIdentifier: string): void {
    persistenceService.setAppState(`linear_link:${worktreePath}`, {
      worktreePath,
      taskId,
      taskIdentifier
    })
  }

  getLinkedTask(worktreePath: string): { worktreePath: string; taskId: string; taskIdentifier: string } | null {
    return persistenceService.getAppState(`linear_link:${worktreePath}`)
  }

  unlinkWorktree(worktreePath: string): void {
    persistenceService.setAppState(`linear_link:${worktreePath}`, null)
  }
}

export const linearService = new LinearService()
