'use client'
import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { urgencyClass, todaySGT } from '@/utils/sgt'

export default function TaskItem({ task, onUpdate, onComplete, onDelete }) {
  const [editingText, setEditingText] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [textVal, setTextVal] = useState(task.text)
  const [dateVal, setDateVal] = useState(task.deadline || todaySGT())

  const urgency = urgencyClass(task.created_at)

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

  const urgencyBg = {
    'urgency-yellow': 'bg-yellow-300 border-yellow-400',
    'urgency-red': 'bg-red-100 border-red-300',
    '': 'bg-gray-800 border-gray-700',
  }[urgency]

  const textColor = urgency === 'urgency-yellow' ? 'text-gray-800' : urgency === 'urgency-red' ? 'text-gray-900' : 'text-gray-100'

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`task-item-${task.id}`}
      className={`flex items-center gap-1 px-2 py-1.5 mb-1 rounded border ${urgencyBg} group`}
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
            className={`text-xs cursor-pointer ${urgency ? 'text-gray-700' : 'text-gray-400'} hover:text-gray-200`}
            onClick={() => setEditingDate(true)}
          >
            {task.deadline
              ? new Date(task.deadline + 'T00:00:00').toLocaleDateString('en-SG', { day: '2-digit', month: 'short' })
              : <span className="text-gray-600">no date</span>}
          </span>
        )}
      </div>

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
