'use client'
import CompletedItem from './CompletedItem'

export default function CompletedList({ tasks, onDelete }) {
  return (
    <div
      data-testid="completed-panel"
      className="flex flex-col border-t-2 border-gray-700"
      style={{ minHeight: '120px', maxHeight: '40vh' }}
    >
      <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Completed {tasks.length > 0 && <span className="ml-1 text-gray-600">({tasks.length})</span>}
      </div>
      <div className="overflow-y-auto p-2">
        {tasks.length === 0 && (
          <p className="text-xs text-gray-700 text-center py-2">No completed tasks</p>
        )}
        {tasks.map((task) => (
          <CompletedItem key={task.id} task={task} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
}
