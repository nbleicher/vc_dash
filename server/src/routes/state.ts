import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { StoreState } from '../types.js'

const keySchema = z.enum([
  'agents',
  'snapshots',
  'perfHistory',
  'qaRecords',
  'auditRecords',
  'attendance',
  'spiffRecords',
  'attendanceSubmissions',
  'intraSubmissions',
  'weeklyTargets',
  'transfers',
  'shadowLogs',
  'vaultMeetings',
  'vaultDocs',
  'eodReports',
])

type StateRoutesConfig = {
  frontendOrigins: string[]
}

export async function stateRoutes(app: FastifyInstance, config: StateRoutesConfig): Promise<void> {
  const normalizeOrigin = (value: string): string => value.trim().replace(/\/+$/, '')
  const allowedOrigins = new Set(config.frontendOrigins.map(normalizeOrigin).filter(Boolean))
  const sseClients = new Set<import('node:http').ServerResponse>()

  const publishStateUpdate = (resource: string) => {
    if (sseClients.size === 0) return
    const payload = JSON.stringify({ resource, timestamp: new Date().toISOString() })
    for (const client of sseClients) {
      client.write(`event: state-updated\n`)
      client.write(`data: ${payload}\n\n`)
    }
    app.log.debug({ resource, clients: sseClients.size }, 'Broadcasted state update event.')
  }

  app.get('/state/stream', { config: { rateLimit: false } }, async (request, reply) => {
    const originHeader = request.headers.origin
    const origin = typeof originHeader === 'string' ? normalizeOrigin(originHeader) : null
    if (origin && !allowedOrigins.has(origin)) {
      return reply.code(403).send({
        error: {
          code: 'CORS_ORIGIN_NOT_ALLOWED',
          message: 'Origin is not allowed.',
        },
      })
    }
    if (origin) {
      reply.raw.setHeader('Access-Control-Allow-Origin', origin)
      reply.raw.setHeader('Vary', 'Origin')
    }
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders?.()

    sseClients.add(reply.raw)
    app.log.debug({ clients: sseClients.size }, 'SSE client connected.')
    reply.raw.write(`event: connected\n`)
    reply.raw.write(`data: ${JSON.stringify({ ok: true })}\n\n`)

    const heartbeatId = setInterval(() => {
      reply.raw.write(': ping\n\n')
    }, 25_000)

    const cleanup = () => {
      clearInterval(heartbeatId)
      sseClients.delete(reply.raw)
      app.log.debug({ clients: sseClients.size }, 'SSE client disconnected.')
    }

    reply.raw.on('close', cleanup)
    reply.raw.on('error', cleanup)

    return reply.hijack()
  })

  app.get('/state', { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } }, async (_request, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate')
    reply.header('Pragma', 'no-cache')
    return reply.send({ data: await app.store.getState() })
  })

  app.get('/state/:key', async (request, reply) => {
    const parse = keySchema.safeParse((request.params as { key: string }).key)
    if (!parse.success) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_RESOURCE',
          message: 'Unknown state resource.',
        },
      })
    }
    return reply.send({ data: await app.store.getCollection(parse.data) })
  })

  app.put('/state/:key', async (request, reply) => {
    const parse = keySchema.safeParse((request.params as { key: string }).key)
    if (!parse.success) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_RESOURCE',
          message: 'Unknown state resource.',
        },
      })
    }
    const rows = request.body as StoreState[typeof parse.data]
    const next = await app.store.replaceCollection(parse.data, rows)
    publishStateUpdate(parse.data)
    return reply.send({ data: next })
  })

  app.post('/state/last-policies-bot-run', async (request, reply) => {
    const body = request.body as { timestamp?: string }
    const timestamp = typeof body?.timestamp === 'string' ? body.timestamp.trim() : null
    if (!timestamp) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Body must include timestamp (ISO string).' },
      })
    }
    await app.store.setLastPoliciesBotRun(timestamp)
    publishStateUpdate('lastPoliciesBotRun')
    return reply.send({ data: { ok: true } })
  })

  app.post('/state/house-marketing', async (request, reply) => {
    const body = request.body as { dateKey?: string; amount?: number }
    const dateKey = typeof body?.dateKey === 'string' ? body.dateKey.trim() : null
    const amount = typeof body?.amount === 'number' && Number.isFinite(body.amount) ? body.amount : Number(body?.amount)
    if (!dateKey || !Number.isFinite(amount)) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Body must include dateKey (string) and amount (number).' },
      })
    }
    await app.store.setHouseMarketing(dateKey, amount)
    publishStateUpdate('houseMarketing')
    return reply.send({ data: { ok: true } })
  })

}
