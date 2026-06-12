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
