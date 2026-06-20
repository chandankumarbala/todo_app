import useSWR from 'swr'
import { useState, useEffect } from 'react'
import {
  getTabs,
  createTab as apiCreateTab,
  updateTab as apiUpdateTab,
  deleteTab as apiDeleteTab,
  reorderTabs as apiReorderTabs,
} from '@/lib/api'

const ACTIVE_TAB_KEY = 'activeTabId'

export function useTabs() {
  const { data: tabs = [], mutate } = useSWR('/api/tabs', getTabs)

  const [activeTabId, setActiveTabIdState] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ACTIVE_TAB_KEY)
      return stored ? parseInt(stored, 10) : null
    }
    return null
  })

  useEffect(() => {
    if (!tabs.length) return
    const valid = tabs.find(t => t.id === activeTabId)
    if (!valid) {
      setActiveTabIdState(tabs[0].id)
      localStorage.setItem(ACTIVE_TAB_KEY, String(tabs[0].id))
    }
  }, [tabs, activeTabId])

  function setActiveTabId(id) {
    setActiveTabIdState(id)
    localStorage.setItem(ACTIVE_TAB_KEY, String(id))
  }

  async function createTab(name) {
    if (tabs.length >= 10) throw new Error('Maximum 10 tabs allowed')
    await apiCreateTab(name)
    await mutate()
  }

  async function updateTab(id, changes) {
    await apiUpdateTab(id, changes)
    await mutate()
  }

  async function deleteTab(id) {
    await apiDeleteTab(id)
    if (id === activeTabId) {
      const remaining = tabs.filter(t => t.id !== id)
      if (remaining.length) setActiveTabId(remaining[0].id)
    }
    await mutate()
  }

  async function reorderTabs(orderedIds) {
    await apiReorderTabs(orderedIds)
    await mutate()
  }

  return { tabs, activeTabId, setActiveTabId, createTab, updateTab, deleteTab, reorderTabs }
}
