// src/hooks/__tests__/useTasks.test.js
import { renderHook } from '@testing-library/react'
import { useTasks } from '../useTasks'

jest.mock('@/lib/api', () => ({
  getTasks: jest.fn().mockResolvedValue([]),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  reorderTasks: jest.fn(),
  togglePriority: jest.fn(),
}))

jest.mock('swr', () => {
  const actual = jest.requireActual('swr')
  const useSWRSpy = jest.fn(actual.default)
  return { __esModule: true, default: useSWRSpy }
})

import useSWR from 'swr'

describe('useTasks SWR config', () => {
  it('passes errorRetryCount: 5 to SWR', () => {
    renderHook(() => useTasks())
    const [, , options] = useSWR.mock.calls[0]
    expect(options.errorRetryCount).toBe(5)
  })

  it('passes errorRetryInterval: 1000 to SWR', () => {
    renderHook(() => useTasks())
    const [, , options] = useSWR.mock.calls[0]
    expect(options.errorRetryInterval).toBe(1000)
  })
})
