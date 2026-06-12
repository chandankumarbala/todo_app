# Priority Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-task priority toggle that floats tasks to the top, shows a 2-hour yellow→blinking-red timer, removes all existing age-based highlighting, and adds tooltips to all controls.

**Architecture:** `priority` + `priority_set_at` columns added to SQLite via migrations in both the Express server and Tauri paths. `priorityState()` in `sgt.js` replaces `urgencyClass()`. `togglePriority()` added to `api.js` and `useTasks.js`. `TaskList` sorts priority tasks above non-priority. `TaskItem` renders the priority flag button with blinking state and tooltips.

**Tech Stack:** Next.js 14 · TailwindCSS · better-sqlite3 · tauri-plugin-sql · Jest · React

---

## File Map

| File | Change |
|------|--------|
| `server/db.js` | Add `ALTER TABLE` for `priority`, `priority_set_at` columns |
| `src-tauri/src/lib.rs` | Add version 2 migration for same columns |
| `server/routes/tasks.js` | Update `PATCH /:id` to handle `priority`, `priority_set_at` |
| `server/__tests__/tasks.test.js` | Add priority PATCH tests |
| `src/utils/sgt.js` | Delete `urgencyClass`, add `priorityState` |
| `src/__tests__/sgt.test.js` | Replace urgency tests with priority tests |
| `src/lib/api.js` | Add `togglePriority` export |
| `src/lib/__tests__/api.test.js` | Add `togglePriority` test |
| `src/hooks/useTasks.js` | Add `togglePriority` function |
| `src/app/page.js` | Destructure + pass `togglePriority` to `TaskList` |
| `src/components/TaskList.jsx` | Sort priority tasks first, pass `onTogglePriority` to `TaskItem` |
| `src/components/TaskItem.jsx` | Priority button, blinking, tooltips, remove urgencyClass |

---

### Task 1: DB schema — add priority columns

**Files:**
- Modify: `server/db.js`
- Modify: `src-tauri/src/lib.rs`
- Modify: `server/routes/tasks.js`
- Modify: `server/__tests__/tasks.test.js`

- [ ] **Step 1: Write failing server test for priority PATCH**

Add to the bottom of `server/__tests__/tasks.test.js` (before the closing `})`):

```js
  it('PATCH /api/tasks/:id sets priority on a task', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ text: 'Priority task', deadline: null })
    const res = await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .send({ priority: 1, priority_set_at: '2026-06-12T10:00:00+08:00' })
    expect(res.status).toBe(200)
    expect(res.body.priority).toBe(1)
    expect(res.body.priority_set_at).toBe('2026-06-12T10:00:00+08:00')
  })

  it('PATCH /api/tasks/:id clears priority', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ text: 'Priority task', deadline: null })
    await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .send({ priority: 1, priority_set_at: '2026-06-12T10:00:00+08:00' })
    const res = await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .send({ priority: 0, priority_set_at: null })
    expect(res.status).toBe(200)
    expect(res.body.priority).toBe(0)
    expect(res.body.priority_set_at).toBeNull()
  })
```

- [ ] **Step 2: Run failing tests**

```bash
npm test -- --testPathPattern=server/__tests__/tasks
```

Expected: 2 new tests fail — `priority` column does not exist.

- [ ] **Step 3: Add ALTER TABLE migrations to `server/db.js`**

In `server/db.js`, after the `db.exec(CREATE TABLE...)` block, add:

```js
  try { db.exec('ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0') } catch (_) {}
  try { db.exec('ALTER TABLE tasks ADD COLUMN priority_set_at TEXT') } catch (_) {}
```

Full updated `getDb` function:

```js
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
```

- [ ] **Step 4: Add version 2 migration to `src-tauri/src/lib.rs`**

Replace the entire file contents:

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_tasks",
            sql: "
                CREATE TABLE IF NOT EXISTS tasks (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    text         TEXT NOT NULL,
                    deadline     TEXT,
                    completed    INTEGER NOT NULL DEFAULT 0,
                    completed_at TEXT,
                    position     INTEGER NOT NULL DEFAULT 0,
                    created_at   TEXT NOT NULL
                );
                PRAGMA journal_mode=WAL;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_priority",
            sql: "ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0; ALTER TABLE tasks ADD COLUMN priority_set_at TEXT;",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:tasks.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Update `server/routes/tasks.js` PATCH handler to handle priority fields**

Replace the `router.patch('/:id', ...)` block with:

```js
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
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
npm test -- --testPathPattern=server/__tests__/tasks
```

Expected: all 7 tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/db.js src-tauri/src/lib.rs server/routes/tasks.js server/__tests__/tasks.test.js
git commit -m "feat: add priority columns to tasks schema and PATCH handler"
```

---

### Task 2: Replace `urgencyClass` with `priorityState` in sgt.js

**Files:**
- Modify: `src/utils/sgt.js`
- Modify: `src/__tests__/sgt.test.js`

- [ ] **Step 1: Write failing tests**

Replace the entire contents of `src/__tests__/sgt.test.js`:

```js
import { todaySGT, priorityState } from '../utils/sgt'

describe('todaySGT', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('returns YYYY-MM-DD string in SGT', () => {
    jest.setSystemTime(new Date('2026-05-29T16:30:00Z')) // 00:30 May 30 SGT
    expect(todaySGT()).toBe('2026-05-30')
  })
})

describe('priorityState', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('returns empty string when priority is 0', () => {
    expect(priorityState(0, '2026-05-29T10:00:00Z')).toBe('')
  })

  it('returns empty string when prioritySetAt is null', () => {
    expect(priorityState(1, null)).toBe('')
  })

  it('returns empty string when prioritySetAt is undefined', () => {
    expect(priorityState(1, undefined)).toBe('')
  })

  it('returns priority-yellow when age is less than 2 hours', () => {
    const setAt = new Date('2026-05-29T10:00:00Z').toISOString()
    jest.setSystemTime(new Date('2026-05-29T11:59:59Z'))
    expect(priorityState(1, setAt)).toBe('priority-yellow')
  })

  it('returns priority-red when age is exactly 2 hours', () => {
    const setAt = new Date('2026-05-29T10:00:00Z').toISOString()
    jest.setSystemTime(new Date('2026-05-29T12:00:00Z'))
    expect(priorityState(1, setAt)).toBe('priority-red')
  })

  it('returns priority-red when age is more than 2 hours', () => {
    const setAt = new Date('2026-05-29T10:00:00Z').toISOString()
    jest.setSystemTime(new Date('2026-05-29T15:00:00Z'))
    expect(priorityState(1, setAt)).toBe('priority-red')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --testPathPattern=src/__tests__/sgt
```

Expected: import of `priorityState` fails — function not exported.

- [ ] **Step 3: Replace `src/utils/sgt.js`**

```js
/**
 * Returns today's date string in YYYY-MM-DD format using Singapore Time (UTC+8).
 */
export function todaySGT() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Singapore' })
}

/**
 * Returns priority display state for a pending task.
 * @param {number} priority - 0 or 1
 * @param {string|null|undefined} prioritySetAt - ISO timestamp when priority was set
 * @returns {'' | 'priority-yellow' | 'priority-red'}
 */
export function priorityState(priority, prioritySetAt) {
  if (!priority || !prioritySetAt) return ''
  const ageMs = Date.now() - new Date(prioritySetAt).getTime()
  if (ageMs >= 2 * 60 * 60 * 1000) return 'priority-red'
  return 'priority-yellow'
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- --testPathPattern=src/__tests__/sgt
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/sgt.js src/__tests__/sgt.test.js
git commit -m "feat: replace urgencyClass with priorityState in sgt.js"
```

---

### Task 3: `togglePriority` in api.js, useTasks.js, page.js

**Files:**
- Modify: `src/lib/api.js`
- Modify: `src/lib/__tests__/api.test.js`
- Modify: `src/hooks/useTasks.js`
- Modify: `src/app/page.js`

- [ ] **Step 1: Write failing api test**

Add to `src/lib/__tests__/api.test.js` (after existing imports, add `togglePriority` to import, then add test):

Updated import line:
```js
import { getTasks, createTask, updateTask, deleteTask, reorderTasks, togglePriority } from '../api'
```

Add test at the bottom:
```js
test('togglePriority on — calls PATCH /api/tasks/:id with priority=1', async () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-06-12T10:00:00+08:00'))
  await togglePriority(7, true)
  expect(mockFetch).toHaveBeenCalledWith('/api/tasks/7', expect.objectContaining({
    method: 'PATCH',
    body: expect.stringContaining('"priority":1'),
  }))
  jest.useRealTimers()
})

test('togglePriority off — calls PATCH /api/tasks/:id with priority=0', async () => {
  await togglePriority(7, false)
  expect(mockFetch).toHaveBeenCalledWith('/api/tasks/7', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({ priority: 0, priority_set_at: null }),
  }))
})
```

- [ ] **Step 2: Run failing tests**

```bash
npm test -- --testPathPattern=src/lib/__tests__/api
```

Expected: 2 new tests fail — `togglePriority` is not a function.

- [ ] **Step 3: Add `togglePriority` to `src/lib/api.js`**

Add after the `reorderTasks` export:

```js
export async function togglePriority(id, priorityOn) {
  const changes = priorityOn
    ? { priority: 1, priority_set_at: nowSGT() }
    : { priority: 0, priority_set_at: null }

  if (isTauri()) {
    const db = await getDB()
    await db.execute(
      'UPDATE tasks SET priority=$1, priority_set_at=$2 WHERE id=$3',
      [changes.priority, changes.priority_set_at, id]
    )
    return
  }
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  if (!res.ok) throw new Error('Failed to toggle priority')
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- --testPathPattern=src/lib/__tests__/api
```

Expected: all 7 tests pass.

- [ ] **Step 5: Add `togglePriority` to `src/hooks/useTasks.js`**

Replace the entire file:

```js
import useSWR from 'swr'
import { getTasks, createTask as apiCreateTask, updateTask as apiUpdateTask, deleteTask as apiDeleteTask, reorderTasks as apiReorderTasks, togglePriority as apiTogglePriority } from '@/lib/api'

const fetcher = () => getTasks()

export function useTasks() {
  const { data, error, mutate } = useSWR('/api/tasks', fetcher, {
    refreshInterval: 60000,
  })

  async function createTask(text, deadline) {
    await apiCreateTask(text, deadline)
    await mutate()
  }

  async function updateTask(id, changes) {
    await apiUpdateTask(id, changes)
    await mutate()
  }

  async function deleteTask(id) {
    await apiDeleteTask(id)
    await mutate()
  }

  async function reorderTasks(orderedIds) {
    await apiReorderTasks(orderedIds)
    await mutate()
  }

  async function completeTask(id) {
    const sgtNow = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Singapore' }).replace(' ', 'T') + '+08:00'
    await updateTask(id, { completed: 1, completed_at: sgtNow })
  }

  async function togglePriority(id) {
    const task = (data || []).find(t => t.id === id)
    if (!task) return
    await apiTogglePriority(id, !task.priority)
    await mutate()
  }

  const pending = (data || []).filter((t) => !t.completed)
  const completed = (data || []).filter((t) => t.completed)

  return {
    pending,
    completed,
    isLoading: !data && !error,
    error,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    completeTask,
    togglePriority,
  }
}
```

- [ ] **Step 6: Update `src/app/page.js` to pass `togglePriority` to `TaskList`**

Replace the entire file:

```js
'use client'
import { useTasks } from '@/hooks/useTasks'
import TaskList from '@/components/TaskList'
import CompletedList from '@/components/CompletedList'

export default function Home() {
  const { pending, completed, isLoading, error, createTask, updateTask, deleteTask, reorderTasks, completeTask, togglePriority } = useTasks()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-500 text-sm">
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-red-400 text-xs p-4 gap-2">
        <span className="font-semibold">Failed to load tasks</span>
        <span className="text-gray-500 text-center">{error.message}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 shrink-0"
        data-tauri-drag-region
      >
        <span className="text-xs font-semibold text-gray-300 tracking-widest uppercase" data-tauri-drag-region>Tasks</span>
        <div className="flex gap-1" style={{ WebkitAppRegion: 'no-drag' }} onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={async () => {
              if (window.__TAURI_INTERNALS__) {
                const { getCurrentWindow } = await import('@tauri-apps/api/window')
                getCurrentWindow().minimize()
              }
            }}
            className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400"
          />
          <button
            onClick={async () => {
              if (window.__TAURI_INTERNALS__) {
                const { getCurrentWindow } = await import('@tauri-apps/api/window')
                getCurrentWindow().close()
              }
            }}
            className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400"
          />
        </div>
      </div>

      {/* Pending panel */}
      <TaskList
        tasks={pending}
        onUpdate={updateTask}
        onComplete={completeTask}
        onDelete={deleteTask}
        onCreate={createTask}
        onReorder={reorderTasks}
        onTogglePriority={togglePriority}
      />

      {/* Completed panel */}
      <CompletedList tasks={completed} onDelete={deleteTask} />
    </div>
  )
}
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: all 22 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/api.js src/lib/__tests__/api.test.js src/hooks/useTasks.js src/app/page.js
git commit -m "feat: togglePriority in api layer and useTasks hook"
```

---

### Task 4: TaskList sorting + TaskItem UI overhaul

**Files:**
- Modify: `src/components/TaskList.jsx`
- Modify: `src/components/TaskItem.jsx`

- [ ] **Step 1: Update `src/components/TaskList.jsx`**

Replace the entire file:

```js
'use client'
import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import TaskItem from './TaskItem'
import NewTaskRow from './NewTaskRow'

export default function TaskList({ tasks, onUpdate, onComplete, onDelete, onCreate, onReorder, onTogglePriority }) {
  const [adding, setAdding] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const sorted = [
    ...tasks.filter(t => t.priority).sort((a, b) =>
      new Date(b.priority_set_at) - new Date(a.priority_set_at)
    ),
    ...tasks.filter(t => !t.priority),
  ]

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sorted.findIndex((t) => t.id === active.id)
    const newIndex = sorted.findIndex((t) => t.id === over.id)
    const reordered = arrayMove(sorted, oldIndex, newIndex)
    onReorder(reordered.map((t) => t.id))
  }

  return (
    <div
      data-testid="pending-panel"
      className="flex-1 min-h-0 flex flex-col"
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget) setAdding(true)
      }}
    >
      <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700">
        Pending {tasks.length > 0 && <span className="ml-1 text-gray-600">({tasks.length})</span>}
      </div>

      <div
        className="flex-1 overflow-y-auto p-2"
        onDoubleClick={(e) => {
          if (e.target === e.currentTarget) setAdding(true)
        }}
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {sorted.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={onUpdate}
                onComplete={onComplete}
                onDelete={onDelete}
                onTogglePriority={onTogglePriority}
              />
            ))}
          </SortableContext>
        </DndContext>

        {adding && (
          <NewTaskRow
            onCreate={(text, deadline) => {
              onCreate(text, deadline)
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        )}

        {tasks.length === 0 && !adding && (
          <p
            className="text-xs text-gray-600 text-center py-4 cursor-default select-none"
            onDoubleClick={() => setAdding(true)}
          >
            double-click to add a task
          </p>
        )}

        {!adding && (
          <div className="flex justify-center pt-1 pb-0.5">
            <button
              onClick={() => setAdding(true)}
              className="text-gray-600 hover:text-gray-400 text-lg leading-none transition-colors"
              title="Add task"
            >+</button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/components/TaskItem.jsx`**

Replace the entire file:

```js
'use client'
import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { priorityState, todaySGT } from '@/utils/sgt'

export default function TaskItem({ task, onUpdate, onComplete, onDelete, onTogglePriority }) {
  const [editingText, setEditingText] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [textVal, setTextVal] = useState(task.text)
  const [dateVal, setDateVal] = useState(task.deadline || todaySGT())

  const pState = priorityState(task.priority, task.priority_set_at)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function saveText() {
    if (textVal.trim() && textVal.trim() !== task.text) {
      onUpdate(task.id, { text: textVal.trim() })
    }
    setEditingText(false)
  }

  function saveDate() {
    if (dateVal !== task.deadline) {
      onUpdate(task.id, { deadline: dateVal || null })
    }
    setEditingDate(false)
  }

  const rowBg = pState === 'priority-yellow' ? 'bg-yellow-300 border-yellow-400'
              : pState === 'priority-red'    ? 'bg-red-100 border-red-300'
              : 'bg-gray-800 border-gray-700'

  const textColor = pState ? 'text-gray-800' : 'text-gray-100'

  const priorityTitle = pState === 'priority-red'    ? 'Remove priority — overdue!'
                      : pState === 'priority-yellow' ? 'Remove priority'
                      : 'Set priority'

  const priorityBtnClass = pState === 'priority-red'    ? 'text-red-500 animate-pulse'
                         : pState === 'priority-yellow' ? 'text-yellow-600'
                         : 'text-gray-500 hover:text-yellow-400'

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`task-item-${task.id}`}
      className={`flex items-center gap-1 px-2 py-1.5 mb-1 rounded border ${rowBg} group`}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-500 hover:text-gray-300 select-none px-1 text-xs"
        title="Drag to reorder"
      >⠿</span>

      <div className="flex-1 min-w-0">
        {editingText ? (
          <input
            autoFocus
            className="w-full bg-transparent border-b border-blue-400 outline-none text-sm text-gray-100"
            value={textVal}
            onChange={(e) => setTextVal(e.target.value)}
            onBlur={saveText}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveText()
              if (e.key === 'Escape') { setTextVal(task.text); setEditingText(false) }
            }}
          />
        ) : (
          <span
            className={`text-sm cursor-pointer truncate block ${textColor}`}
            onClick={() => setEditingText(true)}
            title="Click to edit"
          >
            {task.text}
          </span>
        )}
      </div>

      <div className="shrink-0">
        {editingDate ? (
          <input
            type="date"
            autoFocus
            min={todaySGT()}
            className="text-xs bg-gray-700 text-gray-100 border border-gray-500 rounded px-1"
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
            onBlur={saveDate}
          />
        ) : (
          <span
            className={`text-xs cursor-pointer ${pState ? 'text-gray-700' : 'text-gray-400'} hover:text-gray-200`}
            onClick={() => setEditingDate(true)}
            title="Set deadline"
          >
            {task.deadline
              ? new Date(task.deadline + 'T00:00:00').toLocaleDateString('en-SG', { day: '2-digit', month: 'short' })
              : <span className="text-gray-600">no date</span>}
          </span>
        )}
      </div>

      <button
        onClick={() => onTogglePriority(task.id)}
        title={priorityTitle}
        className={`text-sm px-1 ${priorityBtnClass}`}
      >⚑</button>

      <button
        onClick={() => onComplete(task.id)}
        className="text-green-400 hover:text-green-300 text-sm px-1"
        title="Mark complete"
      >✓</button>

      <button
        onClick={() => onDelete(task.id)}
        className="text-red-500 hover:text-red-400 font-bold text-sm px-1 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete task"
      >🗑</button>
    </div>
  )
}
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass. (No unit tests exist for TaskItem/TaskList components — visual smoke test below.)

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

Open `http://localhost:3847`. Verify:
1. New task has grey ⚑ flag on right side with tooltip "Set priority"
2. Click ⚑ — task moves to top, row turns yellow, flag turns yellow with tooltip "Remove priority"
3. Click ⚑ again — task returns to its original list position, no highlight
4. Set priority, wait 2 hours (or temporarily change `2 * 60 * 60 * 1000` to `10 * 1000` in sgt.js, wait 10s) — row turns red, flag blinks
5. Mark complete or delete while blinking — highlight gone
6. Hover over task text, date, ✓, 🗑 — tooltips visible

- [ ] **Step 5: Commit**

```bash
git add src/components/TaskList.jsx src/components/TaskItem.jsx
git commit -m "feat: priority sorting, blinking flag, and tooltips in TaskList/TaskItem"
```
