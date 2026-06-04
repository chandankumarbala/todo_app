const express = require('express')
const request = require('supertest')
const { getDb } = require('../db')
const tasksRouter = require('../routes/tasks')

function buildApp(db) {
  const app = express()
  app.use(express.json())
  app.use('/api/tasks', tasksRouter(db))
  return app
}

describe('Tasks API', () => {
  let app, db

  beforeEach(() => {
    db = getDb(`:memory:test-${Date.now()}`)
    app = buildApp(db)
  })

  it('GET /api/tasks returns empty array', async () => {
    const res = await request(app).get('/api/tasks')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('POST /api/tasks creates a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ text: 'Buy milk', deadline: '2026-05-30' })
    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.text).toBe('Buy milk')
    expect(res.body.deadline).toBe('2026-05-30')
    expect(res.body.completed).toBe(0)
  })

  it('PATCH /api/tasks/:id updates task text', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ text: 'Old text', deadline: null })
    const res = await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .send({ text: 'New text' })
    expect(res.status).toBe(200)
    expect(res.body.text).toBe('New text')
  })

  it('PATCH /api/tasks/:id marks task complete', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ text: 'Task', deadline: null })
    const res = await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .send({ completed: 1, completed_at: '2026-05-29T10:00:00+08:00' })
    expect(res.status).toBe(200)
    expect(res.body.completed).toBe(1)
    expect(res.body.completed_at).toBe('2026-05-29T10:00:00+08:00')
  })

  it('DELETE /api/tasks/:id removes task', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ text: 'Delete me', deadline: null })
    const del = await request(app).delete(`/api/tasks/${created.body.id}`)
    expect(del.status).toBe(204)
    const list = await request(app).get('/api/tasks')
    expect(list.body).toEqual([])
  })

  it('PATCH /api/tasks/reorder updates positions', async () => {
    const a = await request(app).post('/api/tasks').send({ text: 'A', deadline: null })
    const b = await request(app).post('/api/tasks').send({ text: 'B', deadline: null })
    const res = await request(app)
      .patch('/api/tasks/reorder')
      .send({ order: [b.body.id, a.body.id] })
    expect(res.status).toBe(200)
    const list = await request(app).get('/api/tasks')
    const pending = list.body.filter(t => !t.completed)
    expect(pending[0].id).toBe(b.body.id)
    expect(pending[1].id).toBe(a.body.id)
  })
})
