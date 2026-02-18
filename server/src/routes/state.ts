import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ExportFlags, StoreState } from '../types.js'

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
  'vaultMeetings',
  'vaultDocs',
])

export async function stateRoutes(app: FastifyInstance): Promise<void> {
  app.get('/state', { preHandler: [app.authenticate] }, async (_request, reply) => {
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

  app.post('/export/csv', { preHandler: [app.authenticate] }, async (request, reply) => {
    const flags = (request.body ?? {}) as ExportFlags
    const state = await app.store.getState()
    const rows: string[] = []

    if (flags.agents) {
      rows.push('AGENTS', 'id,name,active,createdAt')
      for (const x of state.agents) rows.push([x.id, x.name, x.active, x.createdAt].join(','))
      rows.push('')
    }
    if (flags.performanceHistory) {
      rows.push('PERFORMANCE_HISTORY', 'id,dateKey,agentId,billableCalls,sales,marketing,cpa,cvr,frozenAt')
      for (const x of state.perfHistory)
        rows.push([x.id, x.dateKey, x.agentId, x.billableCalls, x.sales, x.marketing, x.cpa, x.cvr, x.frozenAt].join(','))
      rows.push('')
    }
    if (flags.qa) {
      rows.push('MASTER_QA', 'id,dateKey,agentId,clientName,decision,status,notes,createdAt,resolvedAt')
      for (const x of state.qaRecords)
        rows.push([x.id, x.dateKey, x.agentId, x.clientName, x.decision, x.status, x.notes, x.createdAt, x.resolvedAt].join(','))
      rows.push('')
    }
    if (flags.audit) {
      rows.push('MASTER_AUDIT', 'id,agentId,carrier,clientName,reason,currentStatus,discoveryTs,mgmtNotified,outreachMade,resolutionTs,notes')
      for (const x of state.auditRecords)
        rows.push(
          [
            x.id,
            x.agentId,
            x.carrier,
            x.clientName,
            x.reason,
            x.currentStatus,
            x.discoveryTs,
            x.mgmtNotified,
            x.outreachMade,
            x.resolutionTs,
            x.notes ?? '',
          ].join(','),
        )
      rows.push('')
    }
    if (flags.attendance) {
      rows.push('ATTENDANCE', 'id,weekKey,dateKey,agentId,percent,notes')
      for (const x of state.attendance) rows.push([x.id, x.weekKey, x.dateKey, x.agentId, x.percent, x.notes].join(','))
      rows.push('')
    }

    reply.header('content-type', 'text/csv; charset=utf-8')
    return reply.send(rows.join('\n'))
  })
}
