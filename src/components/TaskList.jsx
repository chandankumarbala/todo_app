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
    ...tasks.filter(t => t.priority === 1).sort((a, b) =>
      new Date(b.priority_set_at) - new Date(a.priority_set_at)
    ),
    ...tasks.filter(t => t.priority !== 1),
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
