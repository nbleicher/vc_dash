import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

const emptyState = {
  agents: [],
  snapshots: [],
  perfHistory: [],
  qaRecords: [],
  auditRecords: [],
  attendance: [],
  spiffRecords: [],
  attendanceSubmissions: [],
  intraSubmissions: [],
  weeklyTargets: [],
  vaultMeetings: [],
  vaultDocs: [],
}

describe('App smoke', () => {
  it('sends logout request without content-type when no body is present', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/me')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ data: { loggedIn: true, role: 'admin' } }),
        }
      }
      if (url.endsWith('/state')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ data: emptyState }),
        }
      }
      if (url.endsWith('/auth/logout')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ data: { loggedIn: false } }),
        }
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [] }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    const signOut = await screen.findByRole('button', { name: 'Sign Out' })
    signOut.click()

    const logoutCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith('/auth/logout'))
    expect(logoutCall).toBeTruthy()
    const init = logoutCall?.[1] as RequestInit | undefined
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers['content-type']).toBeUndefined()
  })

  it('renders login form when unauthenticated', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '',
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByText('vc.jawnix.com')).toBeInTheDocument()
  })

  it('syncs agents collection to API after adding agent', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/auth/me')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ data: { loggedIn: true, role: 'admin' } }),
        }
      }
      if (url.endsWith('/state')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ data: emptyState }),
        }
      }
      if (url.endsWith('/state/agents') && init?.method === 'PUT') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ data: [] }),
        }
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { loggedIn: false } }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    const input = await screen.findByPlaceholderText('Add agent name')
    fireEvent.change(input, { target: { value: 'New Agent' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Agent' }))

    const putCall = fetchMock.mock.calls.find(
      (call) => String(call[0]).endsWith('/state/agents') && (call[1] as RequestInit)?.method === 'PUT',
    )
    expect(putCall).toBeTruthy()
  })

  it('clears all history after confirmation', async () => {
    const populatedState = {
      ...emptyState,
      agents: [{ id: 'a1', name: 'Alex', active: true, createdAt: '2026-02-15T12:00:00.000Z' }],
      snapshots: [
        {
          id: 'snap1',
          dateKey: '2026-02-15',
          slot: '11:00',
          slotLabel: '11:00 AM',
          agentId: 'a1',
          billableCalls: 5,
          sales: 1,
          updatedAt: '2026-02-15T12:00:00.000Z',
        },
      ],
    }

    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/me')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ data: { loggedIn: true, role: 'admin' } }),
        }
      }
      if (url.endsWith('/state')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ data: populatedState }),
        }
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [] }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear History' }))

    const clearsAgents = fetchMock.mock.calls.some((call) => {
      if (!String(call[0]).endsWith('/state/agents')) return false
      const init = call[1] as RequestInit | undefined
      if (!init || init.method !== 'PUT') return false
      return init.body === '[]'
    })
    const clearsSnapshots = fetchMock.mock.calls.some((call) => {
      if (!String(call[0]).endsWith('/state/snapshots')) return false
      const init = call[1] as RequestInit | undefined
      if (!init || init.method !== 'PUT') return false
      return init.body === '[]'
    })

    expect(clearsAgents).toBe(true)
    expect(clearsSnapshots).toBe(true)
  })

})
