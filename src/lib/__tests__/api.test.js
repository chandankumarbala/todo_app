// Tests fetch path only (isTauri() returns false in JSDOM since window.__TAURI_INTERNALS__ is undefined)
import { getTasks, createTask, updateTask, deleteTask, reorderTasks } from '../api'

const mockJson = jest.fn()
const mockFetch = jest.fn(() => Promise.resolve({ ok: true, json: mockJson, status: 200 }))
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
  mockJson.mockResolvedValue([])
})

test('getTasks calls GET /api/tasks', async () => {
  mockJson.mockResolvedValue([{ id: 1, text: 'test', completed: 0, position: 0 }])
  const result = await getTasks()
  expect(mockFetch).toHaveBeenCalledWith('/api/tasks')
  expect(result).toHaveLength(1)
})

test('createTask calls POST /api/tasks', async () => {
  await createTask('buy milk', '2026-06-10')
  expect(mockFetch).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ text: 'buy milk', deadline: '2026-06-10' }),
  }))
})

test('updateTask calls PATCH /api/tasks/:id', async () => {
  await updateTask(5, { text: 'updated' })
  expect(mockFetch).toHaveBeenCalledWith('/api/tasks/5', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({ text: 'updated' }),
  }))
})

test('deleteTask calls DELETE /api/tasks/:id', async () => {
  await deleteTask(3)
  expect(mockFetch).toHaveBeenCalledWith('/api/tasks/3', { method: 'DELETE' })
})

test('reorderTasks calls PATCH /api/tasks/reorder', async () => {
  await reorderTasks([2, 1, 3])
  expect(mockFetch).toHaveBeenCalledWith('/api/tasks/reorder', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({ order: [2, 1, 3] }),
  }))
})
