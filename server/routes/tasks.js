const express = require('express')

function nowSGT() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Singapore' }).replace(' ', 'T') + '+08:00'
}

module.exports = function tasksRouter(db) {
  const router = express.Router()

  router.get('/', (req, res) => {
    const pending = db.prepare(
      'SELECT * FROM tasks WHERE completed = 0 ORDER BY position ASC'
    ).all()
    const completed = db.prepare(
      'SELECT * FROM tasks WHERE completed = 1 ORDER BY completed_at DESC'
    ).all()
    res.json([...pending, ...completed])
  })

  router.post('/', (req, res) => {
    const { text, deadline } = req.body
    if (!text || !text.trim()) return res.status(400).json({ error: 'text required' })
    const maxPos = db.prepare('SELECT MAX(position) as m FROM tasks WHERE completed = 0').get()
    const position = (maxPos.m ?? -1) + 1
    const stmt = db.prepare(
      'INSERT INTO tasks (text, deadline, position, created_at) VALUES (?, ?, ?, ?)'
    )
    const result = stmt.run(text.trim(), deadline || null, position, nowSGT())
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(task)
  })

  router.patch('/reorder', (req, res) => {
    const { order } = req.body
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' })
    const update = db.prepare('UPDATE tasks SET position = ? WHERE id = ?')
    const updateMany = db.transaction((ids) => {
      ids.forEach((id, index) => update.run(index, id))
    })
    updateMany(order)
    res.json({ ok: true })
  })

  router.patch('/:id', (req, res) => {
    const { text, deadline, completed, completed_at, position, priority, priority_set_at } = req.body
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
    if (!task) return res.status(404).json({ error: 'not found' })

    const updated = {
      text: text !== undefined ? text.trim() : task.text,
      deadline: deadline !== undefined ? deadline : task.deadline,
      completed: completed !== undefined ? completed : task.completed,
      completed_at: completed_at !== undefined ? completed_at : task.completed_at,
      position: position !== undefined ? position : task.position,
      priority: priority !== undefined ? priority : task.priority,
      priority_set_at: priority_set_at !== undefined ? priority_set_at : task.priority_set_at,
    }
    db.prepare(
      'UPDATE tasks SET text=?, deadline=?, completed=?, completed_at=?, position=?, priority=?, priority_set_at=? WHERE id=?'
    ).run(
      updated.text, updated.deadline, updated.completed, updated.completed_at,
      updated.position, updated.priority, updated.priority_set_at, task.id
    )

    res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id))
  })

  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id)
    res.status(204).end()
  })

  return router
}
