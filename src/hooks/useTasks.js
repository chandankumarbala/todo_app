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
    await apiTogglePriority(id, task.priority !== 1)
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
