# Progress Circle — Design Spec

**Date:** 2026-06-13

## Goal

Replace the priority flag (⚑) with a clickable SVG pie-chart circle that tracks per-task completion progress (0→20→40→60→80→100%). Tasks with any progress move to the top of the list. At 100%, the circle blinks red and the row turns red to demand attention until the task is marked complete or deleted.

---

## Behaviour Summary

| Progress | Circle | Row background | Text colour |
|----------|--------|----------------|-------------|
| `0` | Empty grey ring | `bg-gray-800 border-gray-700` | `text-gray-100` |
| `20–80` | Yellow pie fill | `bg-yellow-300 border-yellow-400` | `text-gray-800` |
| `100` | Full red circle + blinking `!` | `bg-red-100 border-red-300` | `text-gray-800` |

**Click behaviour:**
- Each click advances: `0 → 20 → 40 → 60 → 80 → 100 → 0`
- First click (`0 → 20`) moves task to top of pending list
- Returning to `0` drops task back to its natural `position` slot
- At `100%`, circle blinks until task is marked complete or deleted

**Tooltip on circle button:**
- `0%` → `"Set progress"`
- `20–80%` → `"Progress: 40%" ` (current value)
- `100%` → `"Reset progress (100% — needs attention!)"`

---

## Data Layer

### Schema migration

Add one column to `tasks`:

```sql
ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;
```

`priority` and `priority_set_at` columns remain in the DB but are no longer read or written by any code.

**`server/db.js`:**
```js
addColumnIfMissing(db, 'ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0')
```

**`src-tauri/src/lib.rs`** — version 3 migration:
```rust
Migration {
    version: 3,
    description: "add_progress",
    sql: "ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;",
    kind: MigrationKind::Up,
}
```

---

## Progress State & Step Logic

**`src/utils/sgt.js`** — replace `priorityState` with `progressState` and add `nextProgress`:

```js
/**
 * Returns display state for a task based on progress.
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
 * Returns the next progress step after current.
 * @param {number} current - current progress value
 * @returns {number} next step (wraps 100 → 0)
 */
export function nextProgress(current) {
  const idx = PROGRESS_STEPS.indexOf(current)
  if (idx === -1) return 0
  return PROGRESS_STEPS[(idx + 1) % PROGRESS_STEPS.length]
}
```

`todaySGT()` is retained. `priorityState` is deleted.

---

## API Layer

### `src/lib/api.js` — replace `togglePriority` with `updateProgress`

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

### `server/routes/tasks.js` — update PATCH handler

Replace `priority` / `priority_set_at` with `progress`:

```js
const { text, deadline, completed, completed_at, position, progress } = req.body
const updated = {
  // ...existing fields...
  progress: progress !== undefined ? progress : task.progress,
}
// UPDATE SQL: replace priority/priority_set_at columns with progress
'UPDATE tasks SET text=?, deadline=?, completed=?, completed_at=?, position=?, progress=? WHERE id=?'
```

### `src/hooks/useTasks.js` — replace `togglePriority` with `cycleProgress`

```js
async function cycleProgress(id) {
  const task = (data || []).find(t => t.id === id)
  if (!task) return
  try {
    await apiUpdateProgress(id, nextProgress(task.progress ?? 0))
  } finally {
    await mutate()
  }
}
// expose cycleProgress in return object, remove togglePriority
```

---

## List Sorting

**`src/components/TaskList.jsx`** — sort pending tasks before render:

```js
const sorted = [
  ...tasks.filter(t => t.progress > 0).sort((a, b) => b.progress - a.progress),
  ...tasks.filter(t => !t.progress),
]
```

Tasks with progress appear above non-progress tasks, ordered highest-progress first (100% at very top). Non-progress tasks retain `position`-based order.

**Drag guard** — block reordering involving in-progress tasks:
```js
if (activeTask?.progress > 0 || overTask?.progress > 0) return
```

`onReorder` filters out progress tasks before sending positions to server:
```js
onReorder(reordered.filter(t => !t.progress).map(t => t.id))
```

---

## UI — `src/components/TaskItem.jsx`

### Remove
- Import of `priorityState` from `sgt.js`
- `pState` computed from `task.priority` / `task.priority_set_at`
- ⚑ priority button and all `priorityBtnClass` / `priorityTitle` logic
- `onTogglePriority` prop

### Add
- Imports: `progressState`, `nextProgress` from `@/utils/sgt`
- Prop: `onCycleProgress`
- Compute: `const pState = progressState(task.progress ?? 0)`
- Row background and text colour driven by `pState` (same mapping, new state names)

### SVG pie-chart helper (inside component file)

```js
function pieArc(pct) {
  if (pct <= 0) return null
  if (pct >= 100) return null // full circle handled separately
  const angle = (pct / 100) * 360
  const rad = (angle - 90) * (Math.PI / 180)
  const x = +(14 + 11 * Math.cos(rad)).toFixed(2)
  const y = +(14 + 11 * Math.sin(rad)).toFixed(2)
  const large = angle > 180 ? 1 : 0
  return `M14,14 L14,3 A11,11 0 ${large},1 ${x},${y} Z`
}
```

### Progress circle button (replaces ⚑ button)

```jsx
const progress = task.progress ?? 0
const circleTitle =
  progress === 0   ? 'Set progress' :
  progress >= 100  ? 'Reset progress (100% — needs attention!)' :
                     `Progress: ${progress}%`

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
        <circle cx="14" cy="14" r="11" fill="none"
          stroke={pState === 'progress-yellow' ? '#ca8a04' : '#374151'} strokeWidth="2" />
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
```

### Updated prop list for TaskItem

| Prop | Was | Now |
|------|-----|-----|
| `onTogglePriority` | ⚑ toggle | removed |
| `onCycleProgress` | — | new, cycles progress |

---

## Prop Chain Updates

**`src/app/page.js`:**
```jsx
<TaskList
  // remove: onTogglePriority={togglePriority}
  onCycleProgress={cycleProgress}
  ...
/>
```

**`src/components/TaskList.jsx`:**
```jsx
export default function TaskList({ ..., onCycleProgress }) {
  // pass onCycleProgress={onCycleProgress} to each TaskItem
}
```

---

## Removed

- `priorityState` function and all references
- `nextProgress` replaces step logic (new)
- `togglePriority` in `api.js`, `useTasks.js`
- `onTogglePriority` prop across component chain
- `priority` / `priority_set_at` read/write in all API/server code

---

## Testing

**`src/__tests__/sgt.test.js`** — replace `priorityState` tests:
- `progressState(0)` → `''`
- `progressState(20)` → `'progress-yellow'`
- `progressState(80)` → `'progress-yellow'`
- `progressState(100)` → `'progress-red'`
- `nextProgress(0)` → `20`
- `nextProgress(20)` → `40`
- `nextProgress(80)` → `100`
- `nextProgress(100)` → `0`
- `nextProgress(99)` (invalid) → `0`

**`server/__tests__/tasks.test.js`** — replace priority PATCH tests:
- `PATCH /api/tasks/:id` with `{ progress: 40 }` → `res.body.progress === 40`
- `PATCH /api/tasks/:id` with `{ progress: 0 }` → `res.body.progress === 0`
- `PATCH /api/tasks/:id` with `{ progress: 100 }` → `res.body.progress === 100`
