import { renderHook, act } from '@testing-library/react'
import useSWR from 'swr'
import { useTabs } from '../useTabs'

jest.mock('@/lib/api', () => ({
  getTabs: jest.fn().mockResolvedValue([
    { id: 1, name: 'Tasks', position: 0 },
    { id: 2, name: 'Work', position: 1 },
  ]),
  createTab: jest.fn(),
  updateTab: jest.fn(),
  deleteTab: jest.fn(),
  reorderTabs: jest.fn(),
}))

jest.mock('swr', () => {
  const actual = jest.requireActual('swr')
  const useSWRSpy = jest.fn(actual.default)
  return { __esModule: true, default: useSWRSpy }
})

const { createTab: mockCreateTab, updateTab: mockUpdateTab, deleteTab: mockDeleteTab } = require('@/lib/api')

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
})

describe('useTabs', () => {
  it('uses /api/tabs as SWR key', () => {
    renderHook(() => useTabs())
    expect(useSWR.mock.calls[0][0]).toBe('/api/tabs')
  })

  it('initializes activeTabId from localStorage if present', () => {
    localStorage.setItem('activeTabId', '2')
    const { result } = renderHook(() => useTabs())
    expect(result.current.activeTabId).toBe(2)
  })

  it('setActiveTabId updates state and localStorage', () => {
    const { result } = renderHook(() => useTabs())
    act(() => result.current.setActiveTabId(2))
    expect(result.current.activeTabId).toBe(2)
    expect(localStorage.getItem('activeTabId')).toBe('2')
  })

  it('createTab calls apiCreateTab and mutates', async () => {
    const { result } = renderHook(() => useTabs())
    await act(async () => { await result.current.createTab('Personal') })
    expect(mockCreateTab).toHaveBeenCalledWith('Personal')
  })

  it('createTab throws if tabs.length >= 10', async () => {
    const manyTabs = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Tab ${i}`, position: i }))
    useSWR.mockImplementation(() => ({ data: manyTabs, mutate: jest.fn(), isLoading: false, error: undefined }))
    const { result } = renderHook(() => useTabs())
    await expect(result.current.createTab('Overflow')).rejects.toThrow('Maximum 10 tabs allowed')
    expect(mockCreateTab).not.toHaveBeenCalled()
    useSWR.mockImplementation(jest.requireActual('swr').default)
  })

  it('updateTab calls apiUpdateTab', async () => {
    const { result } = renderHook(() => useTabs())
    await act(async () => { await result.current.updateTab(1, { name: 'Renamed' }) })
    expect(mockUpdateTab).toHaveBeenCalledWith(1, { name: 'Renamed' })
  })

  it('deleteTab calls apiDeleteTab', async () => {
    const { result } = renderHook(() => useTabs())
    await act(async () => { await result.current.deleteTab(2) })
    expect(mockDeleteTab).toHaveBeenCalledWith(2)
  })
})
