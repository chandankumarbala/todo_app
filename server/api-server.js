// Dev-mode only: lightweight API-only express server (no Next.js)
// Port 3848 — Next.js dev server proxies /api/* here via next.config.js rewrites
process.on('uncaughtException', (err) => { console.error('[api-server] uncaughtException:', err); process.exit(1) })
process.on('unhandledRejection', (err) => { console.error('[api-server] unhandledRejection:', err); process.exit(1) })

const express = require('express')
const path = require('path')
const { getDb } = require('./db')
const tasksRouter = require('./routes/tasks')

const PORT = 3848
const dbPath = process.env.DB_PATH || path.join(require('os').homedir(), '.task-list', 'tasks.db')

try {
  const db = getDb(dbPath)
  const app = express()
  app.use(express.json())
  app.use('/api/tasks', tasksRouter(db))

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[api-server] ready on http://localhost:${PORT}`)
  })
} catch (err) {
  console.error('[api-server] startup error:', err)
  process.exit(1)
}
