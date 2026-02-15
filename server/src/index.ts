import { buildApp } from './app.js'

const port = Number(process.env.API_PORT ?? 8787)
const host = process.env.API_HOST ?? '0.0.0.0'
const frontendOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean)

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev_jwt_secret_change_me') {
    throw new Error('Set a strong JWT_SECRET in production.')
  }
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin') {
    throw new Error('Set a strong ADMIN_PASSWORD in production.')
  }
  if (!process.env.FRONTEND_ORIGIN) {
    throw new Error('Set FRONTEND_ORIGIN in production.')
  }
}

const app = await buildApp({
  dbPath: process.env.DB_PATH ?? './server/data/vc_dash.sqlite',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? 'dev_jwt_secret_change_me',
  frontendOrigins,
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin',
})

await app.listen({ host, port })
