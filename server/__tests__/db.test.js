const { getDb } = require('../db')

describe('getDb', () => {
  it('creates tasks table on first call', () => {
    const db = getDb(':memory:')
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'"
    ).get()
    expect(row).toBeDefined()
    expect(row.name).toBe('tasks')
    db.close()
  })

  it('returns same instance for same path', () => {
    const db1 = getDb(':memory:test')
    const db2 = getDb(':memory:test')
    expect(db1).toBe(db2)
  })
})
