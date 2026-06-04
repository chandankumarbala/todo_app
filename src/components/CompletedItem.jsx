'use client'

export default function CompletedItem({ task, onDelete }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 mb-1 rounded border border-gray-700 bg-gray-900 group opacity-70">
      <span className="text-green-600 text-xs px-1">✓</span>
      <span className="flex-1 text-sm text-gray-500 line-through truncate">{task.text}</span>
      <span className="text-xs text-gray-600 shrink-0">
        {task.deadline
          ? new Date(task.deadline + 'T00:00:00').toLocaleDateString('en-SG', { day: '2-digit', month: 'short' })
          : ''}
      </span>
      <button
        onClick={() => onDelete(task.id)}
        className="text-red-700 hover:text-red-500 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete"
      >🗑</button>
    </div>
  )
}
