import type { FastifyInstance } from 'fastify'

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Auth endpoints kept for backward compatibility; they now always
  // report logged-in status without enforcing credentials or cookies.
  app.post('/auth/login', async (_request, reply) => {
    return reply.send({ data: { loggedIn: true, role: 'admin' } })
  })

  app.post('/auth/logout', async (_request, reply) => {
    return reply.send({ data: { loggedIn: false } })
  })

  app.get('/auth/me', async (_request, reply) => {
    return reply.send({ data: { loggedIn: true, role: 'admin' } })
  })
}
