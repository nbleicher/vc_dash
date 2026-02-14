import type { FastifyReply, FastifyRequest } from 'fastify'

const AUTH_COOKIE = 'vcdash_token'

export type AuthEnv = {
  adminUsername: string
  adminPassword: string
}

export function cookieName(): string {
  return AUTH_COOKIE
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required.',
      },
    })
  }
}

export function isValidAdmin(username: string, password: string, env: AuthEnv): boolean {
  return username === env.adminUsername && password === env.adminPassword
}
