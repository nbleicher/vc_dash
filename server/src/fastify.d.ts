import type { StoreAdapter } from './db/store.types.js'

declare module 'fastify' {
  interface FastifyInstance {
    store: StoreAdapter
  }
}

export {}
