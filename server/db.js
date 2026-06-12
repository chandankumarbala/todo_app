const Database = require('better-sqlite3')
const fs = require('fs')
const nodePath = require('path')

const instances = {}

function addColumnIfMissing(db, sql) {
  try { db.exec(sql) } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e
  }
}

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
  addColumnIfMissing(db, 'ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'ALTER TABLE tasks ADD COLUMN priority_set_at TEXT')
  instances[path] = db
  return db
}

module.exports = { getDb }
