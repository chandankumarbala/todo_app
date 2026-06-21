function isTauri() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
}

function nowSGT() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Singapore' }).replace(' ', 'T') + '+08:00'
}

let _db = null

async function runMigrations(db) {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS tabs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'Tasks',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
    []
  )
  const tabCount = await db.select('SELECT COUNT(*) as c FROM tabs', [])
  if (tabCount[0].c === 0) {
    await db.execute(
      "INSERT INTO tabs (name, position, created_at) VALUES ('Tasks', 0, $1)",
      [nowSGT()]
    )
  }
  const cols = await db.select('PRAGMA table_info(tasks)', [])
  if (!cols.some(c => c.name === 'tab_id')) {
    await db.execute('ALTER TABLE tasks ADD COLUMN tab_id INTEGER NOT NULL DEFAULT 1', [])
  }
}

async function getDB() {
  if (_db) return _db
  try {
    const { default: Database } = await import('@tauri-apps/plugin-sql')
    _db = await Database.load('sqlite:tasks.db')
    await runMigrations(_db)
  } catch (e) {
    _db = null
    throw e
  }
  return _db
}

export async function getTasks(tabId) {
  if (isTauri()) {
    const db = await getDB()
    const pending = await db.select(
      'SELECT * FROM tasks WHERE completed = 0 AND tab_id = $1 ORDER BY position ASC',
      [tabId]
    )
    const completed = await db.select(
      'SELECT * FROM tasks WHERE completed = 1 AND tab_id = $1 ORDER BY completed_at DESC',
      [tabId]
    )
    return [...pending, ...completed]
  }
  const res = await fetch(`/api/tasks?tab=${tabId}`)
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return res.json()
}

export async function createTask(text, deadline, tabId) {
  if (isTauri()) {
    const db = await getDB()
    const rows = await db.select(
      'SELECT MAX(position) as m FROM tasks WHERE completed = 0 AND tab_id = $1',
      [tabId]
    )
    const position = (rows[0].m ?? -1) + 1
    await db.execute(
      'INSERT INTO tasks (text, deadline, position, created_at, tab_id) VALUES ($1, $2, $3, $4, $5)',
      [text.trim(), deadline || null, position, nowSGT(), tabId]
    )
    return
  }
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, deadline, tab_id: tabId }),
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
      priority: changes.priority !== undefined ? changes.priority : (task.priority ?? 0),
      priority_set_at: changes.priority_set_at !== undefined ? changes.priority_set_at : task.priority_set_at,
    }
    await db.execute(
      'UPDATE tasks SET text=$1, deadline=$2, completed=$3, completed_at=$4, position=$5, priority=$6, priority_set_at=$7 WHERE id=$8',
      [updated.text, updated.deadline, updated.completed, updated.completed_at, updated.position, updated.priority, updated.priority_set_at, id]
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

export async function getTabs() {
  if (isTauri()) {
    const db = await getDB()
    return db.select(
      `SELECT t.*,
        (SELECT COUNT(*) FROM tasks WHERE tab_id = t.id AND completed = 0) AS pending_count
       FROM tabs t
       ORDER BY t.position ASC`,
      []
    )
  }
  const res = await fetch('/api/tabs')
  if (!res.ok) throw new Error('Failed to fetch tabs')
  return res.json()
}

export async function createTab(name) {
  if (isTauri()) {
    const db = await getDB()
    const count = await db.select('SELECT COUNT(*) as c FROM tabs', [])
    if (count[0].c >= 10) throw new Error('Maximum 10 tabs allowed')
    const rows = await db.select('SELECT MAX(position) as m FROM tabs', [])
    const position = (rows[0].m ?? -1) + 1
    await db.execute(
      'INSERT INTO tabs (name, position, created_at) VALUES ($1, $2, $3)',
      [name.trim(), position, nowSGT()]
    )
    return
  }
  const res = await fetch('/api/tabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Failed to create tab')
}

export async function updateTab(id, changes) {
  if (isTauri()) {
    const db = await getDB()
    const rows = await db.select('SELECT * FROM tabs WHERE id = $1', [id])
    if (!rows.length) throw new Error('Tab not found')
    const tab = rows[0]
    const name = changes.name !== undefined ? changes.name.trim() : tab.name
    await db.execute('UPDATE tabs SET name=$1 WHERE id=$2', [name, id])
    return
  }
  const res = await fetch(`/api/tabs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  if (!res.ok) throw new Error('Failed to update tab')
}

export async function deleteTab(id) {
  if (isTauri()) {
    const db = await getDB()
    const tasks = await db.select('SELECT COUNT(*) as c FROM tasks WHERE tab_id = $1', [id])
    if (tasks[0].c > 0) throw new Error('Cannot delete tab with tasks')
    await db.execute('DELETE FROM tabs WHERE id = $1', [id])
    return
  }
  const res = await fetch(`/api/tabs/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete tab')
}

export async function reorderTabs(orderedIds) {
  if (isTauri()) {
    const db = await getDB()
    await db.execute('BEGIN', [])
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.execute('UPDATE tabs SET position = $1 WHERE id = $2', [i, orderedIds[i]])
      }
      await db.execute('COMMIT', [])
    } catch (e) {
      await db.execute('ROLLBACK', [])
      throw e
    }
    return
  }
  await fetch('/api/tabs/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: orderedIds }),
  })
}
