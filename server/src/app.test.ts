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
  frontendOrigin: 'http://localhost:5173',
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

  it('rejects unauthenticated /auth/me', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  it('logs in and issues cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'admin', password: 'admin' },
    })
    expect(res.statusCode).toBe(200)
    const setCookie = res.headers['set-cookie']
    expect(setCookie).toBeTruthy()
    authCookie = Array.isArray(setCookie) ? setCookie[0] : String(setCookie)
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
  it('writes and reads agents collection', async () => {
    const putRes = await app.inject({
      method: 'PUT',
      url: '/state/agents',
      headers: { cookie: authCookie },
      payload: [{ id: 'a1', name: 'Agent One', active: true, createdAt: new Date().toISOString() }],
    })
    expect(putRes.statusCode).toBe(200)

    const getRes = await app.inject({
      method: 'GET',
      url: '/agents',
      headers: { cookie: authCookie },
    })
    expect(getRes.statusCode).toBe(200)
    const parsed = getRes.json() as { data: Array<{ id: string; name: string }> }
    expect(parsed.data).toHaveLength(1)
    expect(parsed.data[0].id).toBe('a1')
  })
})
