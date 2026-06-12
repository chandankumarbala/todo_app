const Database = require('better-sqlite3')
const fs = require('fs')
const nodePath = require('path')

const instances = {}

function getDb(path) {
  if (instances[path]) return instances[path]

  if (path !== ':memory:') {
    fs.mkdirSync(nodePath.dirname(path), { recursive: true })
  }

  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      text         TEXT NOT NULL,
      deadline     TEXT,
      completed    INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      position     INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL
    )
  `)
  try { db.exec('ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0') } catch (_) {}
  try { db.exec('ALTER TABLE tasks ADD COLUMN priority_set_at TEXT') } catch (_) {}
  instances[path] = db
  return db
}

module.exports = { getDb }
