// Tests fetch path only (isTauri() returns false in JSDOM since window.__TAURI_INTERNALS__ is undefined)
import { getTasks, createTask, updateTask, deleteTask, reorderTasks, togglePriority, getTabs, createTab, updateTab, deleteTab, reorderTabs as reorderTabsApi } from '../api'

const mockJson = jest.fn()
const mockFetch = jest.fn(() => Promise.resolve({ ok: true, json: mockJson, status: 200 }))
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
  mockJson.mockResolvedValue([])
})

test('getTasks calls GET /api/tasks?tab=tabId', async () => {
  mockJson.mockResolvedValue([{ id: 1, text: 'test', completed: 0, position: 0 }])
  const result = await getTasks(1)
  expect(mockFetch).toHaveBeenCalledWith('/api/tasks?tab=1')
  expect(result).toHaveLength(1)
})

test('createTask calls POST /api/tasks with tab_id', async () => {
  await createTask('buy milk', '2026-06-10', 1)
  expect(mockFetch).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ text: 'buy milk', deadline: '2026-06-10', tab_id: 1 }),
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

test('togglePriority ON calls PATCH with priority=1 and priority_set_at', async () => {
  await togglePriority(7, true)
  const call = mockFetch.mock.calls[0]
  expect(call[0]).toBe('/api/tasks/7')
  const body = JSON.parse(call[1].body)
  expect(body.priority).toBe(1)
  expect(typeof body.priority_set_at).toBe('string')
  expect(body.priority_set_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
})

test('togglePriority OFF calls PATCH with priority=0 and priority_set_at=null', async () => {
  await togglePriority(7, false)
  expect(mockFetch).toHaveBeenCalledWith('/api/tasks/7', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({ priority: 0, priority_set_at: null }),
  }))
})

describe('tab API (web path)', () => {
  test('getTabs calls GET /api/tabs', async () => {
    mockJson.mockResolvedValue([{ id: 1, name: 'Tasks', position: 0 }])
    const result = await getTabs()
    expect(mockFetch).toHaveBeenCalledWith('/api/tabs')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Tasks')
  })

  test('createTab calls POST /api/tabs', async () => {
    await createTab('Work')
    expect(mockFetch).toHaveBeenCalledWith('/api/tabs', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Work' }),
    }))
  })

  test('updateTab calls PATCH /api/tabs/:id', async () => {
    await updateTab(1, { name: 'Personal' })
    expect(mockFetch).toHaveBeenCalledWith('/api/tabs/1', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ name: 'Personal' }),
    }))
  })

  test('deleteTab calls DELETE /api/tabs/:id', async () => {
    await deleteTab(2)
    expect(mockFetch).toHaveBeenCalledWith('/api/tabs/2', { method: 'DELETE' })
  })

  test('reorderTabsApi calls PATCH /api/tabs/reorder', async () => {
    await reorderTabsApi([2, 1])
    expect(mockFetch).toHaveBeenCalledWith('/api/tabs/reorder', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ order: [2, 1] }),
    }))
  })
})
