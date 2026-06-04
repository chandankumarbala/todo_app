const express = require('express')
const next = require('next')
const path = require('path')
const { getDb } = require('./db')
const tasksRouter = require('./routes/tasks')

const PORT = 3847
const dev = process.env.NODE_ENV !== 'production'
const dbPath = process.env.DB_PATH || path.join(require('os').homedir(), '.task-list', 'tasks.db')

const appDir = path.join(__dirname, '..')

const nextApp = next({ dev, dir: appDir })
const handle = nextApp.getRequestHandler()

nextApp.prepare().then(() => {
  const db = getDb(dbPath)
  const app = express()

  app.use(express.json())
  app.use('/api/tasks', tasksRouter(db))
  app.use('/_next/static', express.static(path.join(appDir, '.next', 'static')))
  app.use('/_next', express.static(path.join(appDir, '.next')))
  app.all('*', (req, res) => handle(req, res))

  app.listen(PORT, '127.0.0.1', () => {
    if (process.send) process.send({ type: 'ready', port: PORT })
    console.log(`Server ready on http://localhost:${PORT}`)
  })
}).catch((err) => {
  console.error('[combined-server] startup failed:', err)
  process.exit(1)
})
