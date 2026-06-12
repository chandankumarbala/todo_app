# Progress Circle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ⚑ priority flag on each task with a clickable SVG pie-chart circle that tracks per-task completion progress (0→20→40→60→80→100%), moves in-progress tasks to the top, and blinks red at 100%.

**Architecture:** Pure client-side step cycling (`nextProgress`) drives a `progress INTEGER` column stored per task. The server PATCH handler accepts `progress`; the client sorts tasks by progress descending before rendering. The priority/priority_set_at columns are left in the DB schema but go unused.

**Tech Stack:** Next.js 14 / React 18, Tailwind CSS, Express + better-sqlite3, Tauri 2 + tauri-plugin-sql, SWR, dnd-kit, Jest.

---

## File Map

| File | Change |
|------|--------|
| `src/utils/sgt.js` | Replace `priorityState` with `progressState` + `nextProgress` |
| `src/__tests__/sgt.test.js` | Replace priority tests with progress + nextProgress tests |
| `server/db.js` | Add `progress` column migration |
| `server/routes/tasks.js` | Replace priority/priority_set_at with progress in PATCH |
| `server/__tests__/tasks.test.js` | Replace priority PATCH tests with progress tests |
| `src/lib/api.js` | Replace `togglePriority` with `updateProgress` |
| `src/hooks/useTasks.js` | Replace `togglePriority` with `cycleProgress` |
| `src/components/TaskList.jsx` | New sort, drag guard, prop rename |
| `src/components/TaskItem.jsx` | Replace ⚑ button with SVG pie circle |
| `src/app/page.js` | Rename prop `onTogglePriority` → `onCycleProgress` |
| `src-tauri/src/lib.rs` | Version 3 migration: add progress column |

---

## Task 1: Replace priorityState with progressState in sgt.js

**Files:**
- Modify: `src/utils/sgt.js`
- Modify: `src/__tests__/sgt.test.js`

### Context

`src/utils/sgt.js` currently exports `todaySGT()` and `priorityState(priority, prioritySetAt)`. We replace `priorityState` with two new exports: `progressState(progress)` and `nextProgress(current)`. `todaySGT` is untouched.

Current `src/__tests__/sgt.test.js` imports `{ todaySGT, priorityState }` and has a `describe('priorityState', ...)` block with 8 tests. Replace that block entirely.

- [ ] **Step 1: Write the failing tests**

Replace the contents of `src/__tests__/sgt.test.js` with:

```js
import { todaySGT, progressState, nextProgress } from '../utils/sgt'

describe('todaySGT', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('returns YYYY-MM-DD string in SGT', () => {
    jest.setSystemTime(new Date('2026-05-29T16:30:00Z')) // 00:30 May 30 SGT
    expect(todaySGT()).toBe('2026-05-30')
  })
})

describe('progressState', () => {
  it('returns empty string when progress is 0', () => {
    expect(progressState(0)).toBe('')
  })

  it('returns empty string when progress is negative', () => {
    expect(progressState(-1)).toBe('')
  })

  it('returns progress-yellow when progress is 20', () => {
    expect(progressState(20)).toBe('progress-yellow')
  })

  it('returns progress-yellow when progress is 80', () => {
    expect(progressState(80)).toBe('progress-yellow')
  })

  it('returns progress-red when progress is 100', () => {
    expect(progressState(100)).toBe('progress-red')
  })
})

describe('nextProgress', () => {
  it('0 → 20', () => expect(nextProgress(0)).toBe(20))
  it('20 → 40', () => expect(nextProgress(20)).toBe(40))
  it('40 → 60', () => expect(nextProgress(40)).toBe(60))
  it('60 → 80', () => expect(nextProgress(60)).toBe(80))
  it('80 → 100', () => expect(nextProgress(80)).toBe(100))
  it('100 → 0 (wrap)', () => expect(nextProgress(100)).toBe(0))
  it('invalid value → 0', () => expect(nextProgress(99)).toBe(0))
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --testPathPattern="sgt" 2>&1 | tail -20
```

Expected: FAIL — `progressState` and `nextProgress` not found.

- [ ] **Step 3: Update sgt.js**

Replace the contents of `src/utils/sgt.js` with:

```js
/**
 * Returns today's date string in YYYY-MM-DD format using Singapore Time (UTC+8).
 */
export function todaySGT() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Singapore' })
}

/**
 * Returns progress display state for a pending task.
 * @param {number} progress - 0, 20, 40, 60, 80, or 100
 * @returns {'' | 'progress-yellow' | 'progress-red'}
 */
export function progressState(progress) {
  if (!progress || progress <= 0) return ''
  if (progress >= 100) return 'progress-red'
  return 'progress-yellow'
}

const PROGRESS_STEPS = [0, 20, 40, 60, 80, 100]

/**
 * Returns the next progress step after current (wraps 100 → 0).
 * @param {number} current - current progress value
 * @returns {number} next step
 */
export function nextProgress(current) {
  const idx = PROGRESS_STEPS.indexOf(current)
  if (idx === -1) return 0
  return PROGRESS_STEPS[(idx + 1) % PROGRESS_STEPS.length]
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- --testPathPattern="sgt" 2>&1 | tail -10
```

Expected: `Tests: 13 passed`

- [ ] **Step 5: Commit**

```bash
git add src/utils/sgt.js src/__tests__/sgt.test.js
git commit -m "feat: replace priorityState with progressState + nextProgress"
```

---

## Task 2: Add progress column to server DB and update PATCH handler

**Files:**
- Modify: `server/db.js`
- Modify: `server/routes/tasks.js`
- Modify: `server/__tests__/tasks.test.js`

### Context

`server/db.js` has an `addColumnIfMissing` helper used to add `priority` and `priority_set_at`. Add the same pattern for `progress`.

`server/routes/tasks.js` PATCH handler currently destructures `priority, priority_set_at` from `req.body` and includes them in the UPDATE SQL. Replace with `progress`.

`server/__tests__/tasks.test.js` has two tests at lines 84–109 for priority PATCH. Replace those with progress tests.

- [ ] **Step 1: Write the failing server tests**

In `server/__tests__/tasks.test.js`, replace the two priority tests (the `it('PATCH /api/tasks/:id sets priority...')` and `it('PATCH /api/tasks/:id clears priority')` blocks at the end of the file) with:

```js
  it('PATCH /api/tasks/:id sets progress on a task', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ text: 'Progress task', deadline: null })
    const res = await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .send({ progress: 40 })
    expect(res.status).toBe(200)
    expect(res.body.progress).toBe(40)
  })

  it('PATCH /api/tasks/:id sets progress to 100', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ text: 'Progress task', deadline: null })
    const res = await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .send({ progress: 100 })
    expect(res.status).toBe(200)
    expect(res.body.progress).toBe(100)
  })

  it('PATCH /api/tasks/:id resets progress to 0', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ text: 'Progress task', deadline: null })
    await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .send({ progress: 60 })
    const res = await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .send({ progress: 0 })
    expect(res.status).toBe(200)
    expect(res.body.progress).toBe(0)
  })
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --testPathPattern="tasks" 2>&1 | tail -20
```

Expected: FAIL — `res.body.progress` is undefined (column doesn't exist yet).

- [ ] **Step 3: Add progress column to db.js**

In `server/db.js`, after the existing two `addColumnIfMissing` calls (around line 33–34), add:

```js
  addColumnIfMissing(db, 'ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0')
```

The full migration block should now read:

```js
  addColumnIfMissing(db, 'ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'ALTER TABLE tasks ADD COLUMN priority_set_at TEXT')
  addColumnIfMissing(db, 'ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0')
```

- [ ] **Step 4: Update PATCH handler in server/routes/tasks.js**

Replace the `router.patch('/:id', ...)` handler (lines 44–66) with:

```js
  router.patch('/:id', (req, res) => {
    const { text, deadline, completed, completed_at, position, progress } = req.body
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
    if (!task) return res.status(404).json({ error: 'not found' })

    const updated = {
      text: text !== undefined ? text.trim() : task.text,
      deadline: deadline !== undefined ? deadline : task.deadline,
      completed: completed !== undefined ? completed : task.completed,
      completed_at: completed_at !== undefined ? completed_at : task.completed_at,
      position: position !== undefined ? position : task.position,
      progress: progress !== undefined ? progress : (task.progress ?? 0),
    }
    db.prepare(
      'UPDATE tasks SET text=?, deadline=?, completed=?, completed_at=?, position=?, progress=? WHERE id=?'
    ).run(
      updated.text, updated.deadline, updated.completed, updated.completed_at,
      updated.position, updated.progress, task.id
    )

    res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id))
  })
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test -- --testPathPattern="tasks" 2>&1 | tail -10
```

Expected: `Tests: 8 passed` (5 original + 3 new progress tests).

- [ ] **Step 6: Commit**

```bash
git add server/db.js server/routes/tasks.js server/__tests__/tasks.test.js
git commit -m "feat: add progress column to DB and server PATCH handler"
```

---

## Task 3: Update api.js — replace togglePriority with updateProgress

**Files:**
- Modify: `src/lib/api.js`

### Context

`src/lib/api.js` currently exports `togglePriority(id, priorityOn)` at the bottom. Replace it with `updateProgress(id, progress)`. The function sends a PATCH to the server (browser) or executes SQL directly (Tauri). No test file exists for api.js — this is covered by integration.

- [ ] **Step 1: Update api.js**

In `src/lib/api.js`, replace the entire `export async function togglePriority(id, priorityOn)` block (lines 113–132) with:

```js
export async function updateProgress(id, progress) {
  if (isTauri()) {
    const db = await getDB()
    await db.execute('UPDATE tasks SET progress=$1 WHERE id=$2', [progress, id])
    return
  }
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress }),
  })
  if (!res.ok) throw new Error('Failed to update progress')
}
```

- [ ] **Step 2: Run all tests — verify nothing broke**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass (api.js has no dedicated unit tests; server + sgt tests still pass).

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.js
git commit -m "feat: replace togglePriority with updateProgress in api.js"
```

---

## Task 4: Update useTasks.js — replace togglePriority with cycleProgress

**Files:**
- Modify: `src/hooks/useTasks.js`

### Context

`src/hooks/useTasks.js` imports `togglePriority as apiTogglePriority` from `@/lib/api`. Replace with `updateProgress as apiUpdateProgress`. The `togglePriority` function in the hook uses `task.priority !== 1` to decide direction — replace with `nextProgress(task.progress ?? 0)` from `@/utils/sgt`.

Current file imports: `import { getTasks, createTask as apiCreateTask, updateTask as apiUpdateTask, deleteTask as apiDeleteTask, reorderTasks as apiReorderTasks, togglePriority as apiTogglePriority } from '@/lib/api'`

- [ ] **Step 1: Update useTasks.js**

Replace the full contents of `src/hooks/useTasks.js` with:

```js
import useSWR from 'swr'
import { getTasks, createTask as apiCreateTask, updateTask as apiUpdateTask, deleteTask as apiDeleteTask, reorderTasks as apiReorderTasks, updateProgress as apiUpdateProgress } from '@/lib/api'
import { nextProgress } from '@/utils/sgt'

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

  async function cycleProgress(id) {
    const task = (data || []).find(t => t.id === id)
    if (!task) return
    try {
      await apiUpdateProgress(id, nextProgress(task.progress ?? 0))
    } finally {
      await mutate()
    }
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
    cycleProgress,
  }
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTasks.js
git commit -m "feat: replace togglePriority with cycleProgress in useTasks"
```

---

## Task 5: Update TaskList.jsx — new sort, drag guard, prop rename

**Files:**
- Modify: `src/components/TaskList.jsx`

### Context

`src/components/TaskList.jsx` currently:
- Sorts by `t.priority === 1` (priority tasks first)
- Drag guard: `activeTask?.priority === 1 || overTask?.priority === 1`
- Passes `onTogglePriority={onTogglePriority}` to each TaskItem
- Destructures `onTogglePriority` from props

Replace all of these with `progress`-based equivalents.

- [ ] **Step 1: Update TaskList.jsx**

Replace the full contents of `src/components/TaskList.jsx` with:

```jsx
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

export default function TaskList({ tasks, onUpdate, onComplete, onDelete, onCreate, onReorder, onCycleProgress }) {
  const [adding, setAdding] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const sorted = [
    ...tasks.filter(t => t.progress > 0).sort((a, b) => b.progress - a.progress),
    ...tasks.filter(t => !t.progress),
  ]

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeTask = sorted.find(t => t.id === active.id)
    const overTask = sorted.find(t => t.id === over.id)
    if (activeTask?.progress > 0 || overTask?.progress > 0) return
    const oldIndex = sorted.findIndex((t) => t.id === active.id)
    const newIndex = sorted.findIndex((t) => t.id === over.id)
    const reordered = arrayMove(sorted, oldIndex, newIndex)
    onReorder(reordered.filter(t => !t.progress).map(t => t.id))
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
                onCycleProgress={onCycleProgress}
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

- [ ] **Step 2: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/TaskList.jsx
git commit -m "feat: update TaskList sort and drag guard for progress"
```

---

## Task 6: Update TaskItem.jsx — replace ⚑ button with SVG pie circle

**Files:**
- Modify: `src/components/TaskItem.jsx`

### Context

`src/components/TaskItem.jsx` currently:
- Imports `priorityState, todaySGT` from `@/utils/sgt`
- Computes `const pState = priorityState(task.priority, task.priority_set_at)`
- Has `rowBg` driven by `priority-yellow` / `priority-red` state names
- Has a `<button>⚑</button>` with `onClick={() => onTogglePriority(task.id)}`
- Accepts `onTogglePriority` prop

Replace with `progressState`, `nextProgress`, `onCycleProgress`, and the SVG pie circle button. The `pieArc` helper computes the SVG path for partial fills.

**SVG coordinate reference** (viewBox 0 0 28 28, centre 14,14, radius 11, start at top = 14,3):
| Progress | Endpoint x | Endpoint y | large-arc-flag |
|----------|-----------|-----------|---------------|
| 20% | 24.46 | 10.60 | 0 |
| 40% | 20.47 | 22.90 | 0 |
| 60% | 7.53 | 22.90 | 1 |
| 80% | 3.54 | 10.60 | 1 |

The `pieArc` function computes these at runtime for any percentage.

- [ ] **Step 1: Update TaskItem.jsx**

Replace the full contents of `src/components/TaskItem.jsx` with:

```jsx
'use client'
import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { progressState, todaySGT } from '@/utils/sgt'

function pieArc(pct) {
  if (pct <= 0 || pct >= 100) return null
  const angle = (pct / 100) * 360
  const rad = (angle - 90) * (Math.PI / 180)
  const x = +(14 + 11 * Math.cos(rad)).toFixed(2)
  const y = +(14 + 11 * Math.sin(rad)).toFixed(2)
  const large = angle > 180 ? 1 : 0
  return `M14,14 L14,3 A11,11 0 ${large},1 ${x},${y} Z`
}

export default function TaskItem({ task, onUpdate, onComplete, onDelete, onCycleProgress }) {
  const [editingText, setEditingText] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [textVal, setTextVal] = useState(task.text)
  const [dateVal, setDateVal] = useState(task.deadline || todaySGT())

  const progress = task.progress ?? 0
  const pState = progressState(progress)

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

  const rowBg = pState === 'progress-yellow' ? 'bg-yellow-300 border-yellow-400'
              : pState === 'progress-red'    ? 'bg-red-100 border-red-300'
              : 'bg-gray-800 border-gray-700'

  const textColor = pState !== '' ? 'text-gray-800' : 'text-gray-100'

  const circleTitle =
    progress === 0  ? 'Set progress' :
    progress >= 100 ? 'Reset progress (100% — needs attention!)' :
                      `Progress: ${progress}%`

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
        onClick={() => onCycleProgress(task.id)}
        title={circleTitle}
        aria-label={circleTitle}
        aria-pressed={progress > 0}
        className="p-0.5 rounded-full hover:bg-white/10 transition-colors"
      >
        <svg
          width="20" height="20" viewBox="0 0 28 28"
          className={progress >= 100 ? 'animate-pulse' : ''}
        >
          {progress <= 0 && (
            <circle cx="14" cy="14" r="11" fill="none" stroke="#4b5563" strokeWidth="2.5" />
          )}
          {progress > 0 && progress < 100 && (
            <>
              <circle cx="14" cy="14" r="11" fill="none" stroke="#ca8a04" strokeWidth="2" />
              <path d={pieArc(progress)} fill="#eab308" />
            </>
          )}
          {progress >= 100 && (
            <>
              <circle cx="14" cy="14" r="11" fill="#ef4444" stroke="#ef4444" strokeWidth="2" />
              <text x="14" y="18" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">!</text>
            </>
          )}
        </svg>
      </button>

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

- [ ] **Step 2: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/TaskItem.jsx
git commit -m "feat: replace priority flag with SVG pie progress circle"
```

---

## Task 7: Update page.js — rename prop

**Files:**
- Modify: `src/app/page.js`

### Context

`src/app/page.js` destructures `togglePriority` from `useTasks()` and passes it as `onTogglePriority` to `<TaskList>`. Rename both.

- [ ] **Step 1: Update page.js**

Replace the full contents of `src/app/page.js` with:

```js
'use client'
import { useTasks } from '@/hooks/useTasks'
import TaskList from '@/components/TaskList'
import CompletedList from '@/components/CompletedList'

export default function Home() {
  const { pending, completed, isLoading, error, createTask, updateTask, deleteTask, reorderTasks, completeTask, cycleProgress } = useTasks()

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
        onCycleProgress={cycleProgress}
      />

      {/* Completed panel */}
      <CompletedList tasks={completed} onDelete={deleteTask} />
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.js
git commit -m "feat: wire cycleProgress prop through page → TaskList"
```

---

## Task 8: Add Tauri version 3 migration

**Files:**
- Modify: `src-tauri/src/lib.rs`

### Context

`src-tauri/src/lib.rs` has a `migrations` vector with version 1 (initial schema) and version 2 (add priority/priority_set_at). Add version 3 for the progress column.

- [ ] **Step 1: Read the current migrations block**

Open `src-tauri/src/lib.rs` and find the `let migrations = vec![` block (around line 5). It currently ends with the version 2 `Migration { ... }` entry followed by `];`.

- [ ] **Step 2: Add version 3 migration**

Insert the following after the version 2 migration entry (before the closing `]`):

```rust
        Migration {
            version: 3,
            description: "add_progress",
            sql: "ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
```

The full migrations block should now look like:

```rust
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: "CREATE TABLE IF NOT EXISTS tasks (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                text         TEXT NOT NULL,
                deadline     TEXT,
                completed    INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                position     INTEGER NOT NULL DEFAULT 0,
                created_at   TEXT NOT NULL
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_priority",
            sql: "ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0; ALTER TABLE tasks ADD COLUMN priority_set_at TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_progress",
            sql: "ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
    ];
```

- [ ] **Step 3: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass (Rust is not compiled by Jest — this is verified at Tauri build time).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: Tauri migration v3 — add progress column"
```

---

## Task 9: Smoke test in dev

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:3847` in browser.

- [ ] **Step 2: Verify circle states**

- New task → grey empty ring visible in place of ⚑
- Click circle once → ring fills 20% yellow, row turns yellow, task jumps to top
- Click 4 more times → 40%, 60%, 80% (all yellow), then 100% (full red, blinking !, row red)
- At 100% → circle blinks continuously
- Click circle at 100% → resets to 0%, row returns grey, task returns to original position

- [ ] **Step 3: Verify tooltips**

Hover over circle at 0% → `"Set progress"`
Hover at 40% → `"Progress: 40%"`
Hover at 100% → `"Reset progress (100% — needs attention!)"`

- [ ] **Step 4: Verify complete resolves blink**

Set a task to 100%. Click ✓ → task moves to completed list, blink stops.

- [ ] **Step 5: Final test run**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: progress circle — complete implementation"
```
