import type {
  Agent,
  AttendanceRecord,
  AttendanceSubmission,
  AuditRecord,
  IntraSubmission,
  PerfHistory,
  QaRecord,
  Snapshot,
  SpiffRecord,
  VaultDoc,
  VaultMeeting,
  WeeklyTarget,
} from '../types'

export type StoreCollections = {
  agents: Agent[]
  snapshots: Snapshot[]
  perfHistory: PerfHistory[]
  qaRecords: QaRecord[]
  auditRecords: AuditRecord[]
  attendance: AttendanceRecord[]
  spiffRecords: SpiffRecord[]
  attendanceSubmissions: AttendanceSubmission[]
  intraSubmissions: IntraSubmission[]
  weeklyTargets: WeeklyTarget[]
  vaultMeetings: VaultMeeting[]
  vaultDocs: VaultDoc[]
}

type ApiSuccess<T> = { data: T }
type ApiError = { error?: { code?: string; message?: string } }

export class ApiClient {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  async login(username: string, password: string): Promise<void> {
    await this.request('/auth/login', { method: 'POST', body: { username, password } })
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' })
  }

  async me(): Promise<boolean> {
    try {
      await this.request('/auth/me', { method: 'GET' })
      return true
    } catch {
      return false
    }
  }

  async getState(): Promise<StoreCollections> {
    return this.request<StoreCollections>('/state', { method: 'GET' })
  }

  async putCollection<K extends keyof StoreCollections>(key: K, value: StoreCollections[K]): Promise<void> {
    await this.request(`/state/${String(key)}`, { method: 'PUT', body: value })
  }

  private async request<T = void>(
    path: string,
    options: { method: string; body?: unknown; headers?: Record<string, string> },
  ): Promise<T> {
    const hasBody = options.body !== undefined
    const headers: Record<string, string> = {
      ...(options.headers ?? {}),
    }
    if (hasBody) {
      headers['content-type'] = 'application/json'
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method,
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
      // Prevent cached GET so dashboard always sees latest snapshots after bot runs
      cache: options.method === 'GET' ? 'no-store' : 'default',
    })

    if (!response.ok) {
      let errorMessage = `Request failed (${response.status})`
      try {
        const payload = (await response.json()) as ApiError
        if (payload.error?.message) errorMessage = payload.error.message
      } catch {
        // Keep fallback message when body is non-JSON.
      }
      throw new Error(errorMessage)
    }

    const text = await response.text()
    if (!text) return undefined as T
    const payload = JSON.parse(text) as ApiSuccess<T>
    return payload.data
  }
}

export function createApiClient(): ApiClient {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'
  return new ApiClient(base)
}
