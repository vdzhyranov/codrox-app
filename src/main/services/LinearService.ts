import { safeStorage } from 'electron'
import { persistenceService } from './PersistenceService'
import type {
  LinearUser,
  LinearTeam,
  LinearTask,
  LinearAuthState,
  CreateTaskInput
} from '@shared/types/linear'

const GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql'

class LinearService {
  private apiKey: string | null = null

  constructor() {
    this.loadApiKey()
  }

  // ─── API key management ──────────────────────────────────

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
    try {
      const encrypted = safeStorage.isEncryptionAvailable()
      const stored = encrypted
        ? safeStorage.encryptString(apiKey).toString('base64')
        : apiKey
      persistenceService.setAppState('linear_api_key', { key: stored, encrypted })
    } catch {
      persistenceService.setAppState('linear_api_key', { key: apiKey, encrypted: false })
    }
  }

  getStoredApiKey(): string {
    return this.apiKey || ''
  }

  private loadApiKey(): void {
    try {
      const data = persistenceService.getAppState<{ key: string; encrypted: boolean }>('linear_api_key')
      if (!data) return
      if (data.encrypted && safeStorage.isEncryptionAvailable()) {
        this.apiKey = safeStorage.decryptString(Buffer.from(data.key, 'base64'))
      } else {
        this.apiKey = data.key
      }
    } catch {
      this.apiKey = null
    }
  }

  // ─── Auth ────────────────────────────────────────────────

  async authenticate(apiKey: string): Promise<{ success: boolean; user: LinearUser | null }> {
    // Validate the key by fetching the user
    this.apiKey = apiKey
    try {
      const user = await this.getCurrentUser()
      this.setApiKey(apiKey)
      persistenceService.setAppState('linear_user', user)
      return { success: true, user }
    } catch (err) {
      this.apiKey = null
      throw new Error(
        err instanceof Error ? err.message : 'Invalid API key. Check your token and try again.'
      )
    }
  }

  async logout(): Promise<void> {
    this.apiKey = null
    persistenceService.setAppState('linear_api_key', null)
    persistenceService.setAppState('linear_user', null)
  }

  async getAuthStatus(): Promise<LinearAuthState> {
    if (this.apiKey) {
      const user = persistenceService.getAppState<LinearUser>('linear_user')
      return { isAuthenticated: true, user }
    }
    return { isAuthenticated: false, user: null }
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
