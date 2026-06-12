function isTauri() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
}

function nowSGT() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Singapore' }).replace(' ', 'T') + '+08:00'
}

let _db = null

async function getDB() {
  if (_db) return _db
  try {
    const { default: Database } = await import('@tauri-apps/plugin-sql')
    _db = await Database.load('sqlite:tasks.db')
  } catch (e) {
    _db = null
    throw e
  }
  return _db
}

export async function getTasks() {
  if (isTauri()) {
    const db = await getDB()
    const pending = await db.select('SELECT * FROM tasks WHERE completed = 0 ORDER BY position ASC')
    const completed = await db.select('SELECT * FROM tasks WHERE completed = 1 ORDER BY completed_at DESC')
    return [...pending, ...completed]
  }
  const res = await fetch('/api/tasks')
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return res.json()
}

export async function createTask(text, deadline) {
  if (isTauri()) {
    const db = await getDB()
    const rows = await db.select('SELECT MAX(position) as m FROM tasks WHERE completed = 0')
    const position = (rows[0].m ?? -1) + 1
    await db.execute(
      'INSERT INTO tasks (text, deadline, position, created_at) VALUES ($1, $2, $3, $4)',
      [text.trim(), deadline || null, position, nowSGT()]
    )
    return
  }
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, deadline }),
  })
  if (!res.ok) throw new Error('Failed to create task')
}

export async function updateTask(id, changes) {
  if (isTauri()) {
    const db = await getDB()
    const rows = await db.select('SELECT * FROM tasks WHERE id = $1', [id])
    if (!rows.length) throw new Error('Task not found')
    const task = rows[0]
    const updated = {
      text: changes.text !== undefined ? changes.text.trim() : task.text,
      deadline: changes.deadline !== undefined ? changes.deadline : task.deadline,
      completed: changes.completed !== undefined ? changes.completed : task.completed,
      completed_at: changes.completed_at !== undefined ? changes.completed_at : task.completed_at,
      position: changes.position !== undefined ? changes.position : task.position,
    }
    await db.execute(
      'UPDATE tasks SET text=$1, deadline=$2, completed=$3, completed_at=$4, position=$5 WHERE id=$6',
      [updated.text, updated.deadline, updated.completed, updated.completed_at, updated.position, id]
    )
    return
  }
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  if (!res.ok) throw new Error('Failed to update task')
}

export async function deleteTask(id) {
  if (isTauri()) {
    const db = await getDB()
    await db.execute('DELETE FROM tasks WHERE id = $1', [id])
    return
  }
  const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete task')
}

export async function reorderTasks(orderedIds) {
  if (isTauri()) {
    const db = await getDB()
    await db.execute('BEGIN', [])
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.execute('UPDATE tasks SET position = $1 WHERE id = $2', [i, orderedIds[i]])
      }
      await db.execute('COMMIT', [])
    } catch (e) {
      await db.execute('ROLLBACK', [])
      throw e
    }
    return
  }
  await fetch('/api/tasks/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: orderedIds }),
  })
}

export async function togglePriority(id, priorityOn) {
  const priority = priorityOn ? 1 : 0
  const priority_set_at = priorityOn ? new Date().toISOString() : null
  if (isTauri()) {
    const db = await getDB()
    await db.execute(
      'UPDATE tasks SET priority=$1, priority_set_at=$2 WHERE id=$3',
      [priority, priority_set_at, id]
    )
    return
  }
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priority, priority_set_at }),
  })
  if (!res.ok) throw new Error('Failed to toggle priority')
}
