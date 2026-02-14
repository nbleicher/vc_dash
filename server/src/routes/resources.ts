import type { FastifyInstance } from 'fastify'
import type { StoreState } from '../types.js'

type Config<K extends keyof StoreState> = {
  path: string
  key: K
  idField: string
}

const resourceConfigs: Array<Config<keyof StoreState>> = [
  { path: 'agents', key: 'agents', idField: 'id' },
  { path: 'snapshots', key: 'snapshots', idField: 'id' },
  { path: 'perf-history', key: 'perfHistory', idField: 'id' },
  { path: 'qa-records', key: 'qaRecords', idField: 'id' },
  { path: 'audit-records', key: 'auditRecords', idField: 'id' },
  { path: 'attendance', key: 'attendance', idField: 'id' },
  { path: 'weekly-targets', key: 'weeklyTargets', idField: 'weekKey' },
  { path: 'vault-meetings', key: 'vaultMeetings', idField: 'id' },
  { path: 'vault-docs', key: 'vaultDocs', idField: 'id' },
]

export async function resourceRoutes(app: FastifyInstance): Promise<void> {
  for (const config of resourceConfigs) {
    app.get(`/${config.path}`, { preHandler: [app.authenticate] }, async (_request, reply) => {
      return reply.send({ data: await app.store.getCollection(config.key) })
    })

    app.put(`/${config.path}`, { preHandler: [app.authenticate] }, async (request, reply) => {
      const rows = request.body as StoreState[typeof config.key]
      return reply.send({ data: await app.store.replaceCollection(config.key, rows) })
    })

    app.patch(`/${config.path}/:id`, { preHandler: [app.authenticate] }, async (request, reply) => {
      const { id } = request.params as { id: string }
      const patch = request.body as Record<string, unknown>
      const existing = (await app.store.getCollection(config.key)) as Array<Record<string, unknown>>
      const next = existing.map((row) =>
        String(row[String(config.idField)]) === id ? { ...row, ...patch } : row,
      )
      await app.store.replaceCollection(config.key, next as never)
      const updated = next.find((row) => String(row[String(config.idField)]) === id)
      if (!updated) {
        return reply.code(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `No ${config.path} record found for id ${id}.`,
          },
        })
      }
      return reply.send({ data: updated })
    })
  }
}
