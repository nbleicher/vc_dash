import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { runMigrations } from './db/migrate.js'
import { PostgresStore } from './db/postgres-store.js'
import { SqliteStore } from './db/store.js'
import type { StoreAdapter } from './db/store.types.js'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'
import { metricsRoutes } from './routes/metrics.js'
import { resourceRoutes } from './routes/resources.js'
import { stateRoutes } from './routes/state.js'

export type AppConfig = {
  dbPath: string
  databaseUrl?: string
  jwtSecret: string
  frontendOrigins: string[]
  adminUsername: string
  adminPassword: string
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>
    store: StoreAdapter
  }
}

export async function buildApp(config: AppConfig) {
  const normalizeOrigin = (value: string): string => value.trim().replace(/\/+$/, '')
  let store: StoreAdapter
  if (config.databaseUrl) {
    const postgresStore = new PostgresStore(config.databaseUrl)
    await postgresStore.init()
    store = postgresStore
  } else {
    runMigrations(config.dbPath)
    store = new SqliteStore(config.dbPath)
  }

  const allowedOrigins = new Set(config.frontendOrigins.map(normalizeOrigin).filter(Boolean))
  const app = Fastify({ logger: true, trustProxy: true })
  app.decorate('store', store)
  app.decorate('authenticate', async function authenticate(request: FastifyRequest, reply: FastifyReply) {
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
  })

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }
      callback(null, allowedOrigins.has(normalizeOrigin(origin)))
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'cache-control', 'pragma'],
    maxAge: 86400,
  })
  await app.register(cookie)
  await app.register(rateLimit, {
    max: 60,
    timeWindow: '1 minute',
  })
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: {
      cookieName: 'vcdash_token',
      signed: false,
    },
  })

  await healthRoutes(app)
  await authRoutes(app, { adminUsername: config.adminUsername, adminPassword: config.adminPassword })
  await metricsRoutes(app)
  await resourceRoutes(app)
  await stateRoutes(app)

  app.addHook('onClose', async () => {
    await store.close()
  })

  return app
}
