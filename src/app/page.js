'use client'
import { useTabs } from '@/hooks/useTabs'
import { useTasks } from '@/hooks/useTasks'
import TabBar from '@/components/TabBar'
import TaskList from '@/components/TaskList'
import CompletedList from '@/components/CompletedList'

export default function Home() {
  const { tabs, activeTabId, setActiveTabId, createTab, updateTab, deleteTab } = useTabs()
  const { pending, completed, isLoading, error, createTask, updateTask, deleteTask, reorderTasks, completeTask, startOrResetPriority } = useTasks(activeTabId)

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

  async function handleAddTab() {
    try {
      await createTab('New Tab')
    } catch (e) {
      console.error('createTab failed:', e)
    }
  }

  async function handleDeleteTab(id) {
    try {
      await deleteTab(id)
    } catch (e) {
      alert(e.message)
    }
  }

  async function handleRenameTab(id, name) {
    try {
      await updateTab(id, { name })
    } catch (e) {
      console.error('updateTab failed:', e)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 shrink-0"
        data-tauri-drag-region
      >
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={setActiveTabId}
          onAdd={handleAddTab}
          onRename={handleRenameTab}
          onDelete={handleDeleteTab}
        />
        <div className="flex gap-1 shrink-0" style={{ WebkitAppRegion: 'no-drag' }} onMouseDown={(e) => e.stopPropagation()}>
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
        onTogglePriority={startOrResetPriority}
      />

      {/* Completed panel */}
      <CompletedList tasks={completed} onDelete={deleteTask} />
    </div>
  )
}
