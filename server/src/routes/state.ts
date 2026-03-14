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
  'vaultMeetings',
  'vaultDocs',
  'eodReports',
])

export async function stateRoutes(app: FastifyInstance): Promise<void> {
  app.get('/state', { preHandler: [app.authenticate] }, async (_request, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate')
    reply.header('Pragma', 'no-cache')
    return reply.send({ data: await app.store.getState() })
  })

  app.get('/state/:key', { preHandler: [app.authenticate] }, async (request, reply) => {
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

  app.put('/state/:key', { preHandler: [app.authenticate] }, async (request, reply) => {
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
    return reply.send({ data: next })
  })

  app.post('/state/last-policies-bot-run', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body as { timestamp?: string }
    const timestamp = typeof body?.timestamp === 'string' ? body.timestamp.trim() : null
    if (!timestamp) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Body must include timestamp (ISO string).' },
      })
    }
    await app.store.setLastPoliciesBotRun(timestamp)
    return reply.send({ data: { ok: true } })
  })

  app.post('/state/house-marketing', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body as { dateKey?: string; amount?: number }
    const dateKey = typeof body?.dateKey === 'string' ? body.dateKey.trim() : null
    const amount = typeof body?.amount === 'number' && Number.isFinite(body.amount) ? body.amount : Number(body?.amount)
    if (!dateKey || !Number.isFinite(amount)) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Body must include dateKey (string) and amount (number).' },
      })
    }
    await app.store.setHouseMarketing(dateKey, amount)
    return reply.send({ data: { ok: true } })
  })

}
