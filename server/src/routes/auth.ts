import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { cookieName, isValidAdmin, type AuthEnv } from '../auth.js'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function authRoutes(app: FastifyInstance, env: AuthEnv): Promise<void> {
  app.post('/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parse = loginSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_BODY',
          message: 'Invalid login payload.',
          details: parse.error.flatten(),
        },
      })
    }

    if (!isValidAdmin(parse.data.username, parse.data.password, env)) {
      return reply.code(401).send({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials.',
        },
      })
    }

    const token = app.jwt.sign({ sub: 'admin', role: 'admin' }, { expiresIn: '12h' })
    const isHttps = request.protocol === 'https'
    const sameSite = isHttps ? 'none' : 'lax'
    reply.setCookie(cookieName(), token, {
      path: '/',
      httpOnly: true,
      sameSite,
      secure: isHttps,
    })

    return reply.send({ data: { loggedIn: true, role: 'admin' } })
  })

  app.post('/auth/logout', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const isHttps = request.protocol === 'https'
    const sameSite = isHttps ? 'none' : 'lax'
    reply.clearCookie(cookieName(), { path: '/', sameSite, secure: isHttps })
    return reply.send({ data: { loggedIn: false } })
  })

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (_request, reply) => {
    return reply.send({ data: { loggedIn: true, role: 'admin' } })
  })
}
