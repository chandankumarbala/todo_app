// src/components/TaskItem.jsx
'use client'
import { useState, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { priorityProgress, priorityState, todaySGT } from '@/utils/sgt'

function pieArc(pct) {
  if (pct <= 0 || pct >= 100) return null
  const angle = (pct / 100) * 360
  const rad = (angle - 90) * (Math.PI / 180)
  const x = +(14 + 11 * Math.cos(rad)).toFixed(2)
  const y = +(14 + 11 * Math.sin(rad)).toFixed(2)
  const large = angle > 180 ? 1 : 0
  return `M14,14 L14,3 A11,11 0 ${large},1 ${x},${y} Z`
}

export default function TaskItem({ task, onUpdate, onComplete, onDelete, onTogglePriority }) {
  const [editingText, setEditingText] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [textVal, setTextVal] = useState(task.text)
  const [dateVal, setDateVal] = useState(task.deadline || todaySGT())
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!task.priority) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [task.priority])

  const progress = priorityProgress(task.priority, task.priority_set_at, now)
  const pState = priorityState(task.priority, task.priority_set_at, now)

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

  const textColor = pState !== '' ? 'text-gray-800' : 'text-gray-100'

  const circleTitle =
    !task.priority    ? 'Start 2-hour timer' :
    progress >= 100   ? 'Reset timer (overdue!)' :
                        `Timer running — ${Math.round(progress)}% elapsed (click to reset)`

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
            onPointerDown={e => e.stopPropagation()}
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
            onPointerDown={e => e.stopPropagation()}
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
        onPointerDown={e => e.stopPropagation()}
        title={circleTitle}
        aria-label={circleTitle}
        aria-pressed={!!task.priority}
        className="p-0.5 rounded-full hover:bg-white/10 transition-colors"
      >
        <svg
          width="20" height="20" viewBox="0 0 28 28"
          aria-hidden="true"
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
        onPointerDown={e => e.stopPropagation()}
        className="text-green-400 hover:text-green-300 text-sm px-1"
        title="Mark complete"
      >✓</button>

      <button
        onClick={() => onDelete(task.id)}
        onPointerDown={e => e.stopPropagation()}
        className="text-red-500 hover:text-red-400 font-bold text-sm px-1 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete task"
      >🗑</button>
    </div>
  )
}
