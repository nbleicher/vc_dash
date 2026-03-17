import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

const tempRoot = mkdtempSync(join(tmpdir(), 'vcdash-api-'))
const dbPath = join(tempRoot, 'test.sqlite')

const app = await buildApp({
  dbPath,
  jwtSecret: 'test-secret',
  frontendOrigins: ['http://localhost:5173/'],
  adminUsername: 'admin',
  adminPassword: 'admin',
})

let authCookie = ''

beforeAll(async () => {
  await app.ready()
})

afterAll(async () => {
  await app.close()
  rmSync(tempRoot, { recursive: true, force: true })
})

describe('auth', () => {
  it('reports healthy service with DB check', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const parsed = res.json() as { data: { ok: boolean; db: string } }
    expect(parsed.data.ok).toBe(true)
    expect(parsed.data.db).toBe('ok')
  })

  it('returns logged-in state from /auth/me (no auth required)', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(200)
    const parsed = res.json() as { data: { loggedIn: boolean; role: string } }
    expect(parsed.data.loggedIn).toBe(true)
    expect(parsed.data.role).toBe('admin')
  })

  it('logs in successfully (no cookie required)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'admin', password: 'admin' },
    })
    expect(res.statusCode).toBe(200)
    const parsed = res.json() as { data: { loggedIn: boolean; role: string } }
    expect(parsed.data.loggedIn).toBe(true)
    expect(parsed.data.role).toBe('admin')
    // In no-auth mode we don't rely on cookies, so authCookie is unused
    authCookie = ''
  })

  it('logs out successfully with no body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const parsed = res.json() as { data: { loggedIn: boolean } }
    expect(parsed.data.loggedIn).toBe(false)
  })
})

describe('state resources', () => {
  it('responds to CORS preflight for state routes', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/state/agents',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'content-type',
      },
    })
    expect(res.statusCode).toBe(204)
    expect(String(res.headers['access-control-allow-methods'] ?? '')).toContain('PUT')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('writes and reads agents collection via state API', async () => {
    const putRes = await app.inject({
      method: 'PUT',
      url: '/state/agents',
      headers: { cookie: authCookie },
      payload: [{ id: 'a1', name: 'Agent One', active: true, createdAt: new Date().toISOString() }],
    })
    expect(putRes.statusCode).toBe(200)

    const getRes = await app.inject({
      method: 'GET',
      url: '/state',
      headers: { cookie: authCookie },
    })
    expect(getRes.statusCode).toBe(200)
    const parsed = getRes.json() as { data: { agents: Array<{ id: string; name: string }> } }
    expect(parsed.data.agents).toHaveLength(1)
    expect(parsed.data.agents[0].id).toBe('a1')
  })
})
