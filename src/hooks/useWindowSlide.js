'use client'
import { useEffect } from 'react'

export function useWindowSlide() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return

    let intervalId = null
    let unlistenBlur = null
    let unlistenFocus = null
    let aborted = false

    async function init() {
      const { getCurrentWindow, currentMonitor } = await import('@tauri-apps/api/window')
      const { LogicalSize, LogicalPosition } = await import('@tauri-apps/api/dpi')

      const win = getCurrentWindow()
      const monitor = await currentMonitor()
      if (!monitor) return

      const scaleFactor = monitor.scaleFactor
      const screenWidth = monitor.size.width / scaleFactor
      const screenHeight = monitor.size.height / scaleFactor
      const winWidth = Math.round(screenWidth * 0.3)
      const MENU_BAR = 28 // macOS menu bar height (logical px)

      await win.setSize(new LogicalSize(winWidth, screenHeight - MENU_BAR))
      await win.setPosition(new LogicalPosition(screenWidth - winWidth, MENU_BAR))

      function slideTo(targetX) {
        if (intervalId) { clearTimeout(intervalId); intervalId = null }
        const step = async () => {
          const phys = await win.outerPosition()
          const currentX = phys.x / scaleFactor
          const diff = targetX - currentX
          if (Math.abs(diff) < 2) {
            await win.setPosition(new LogicalPosition(targetX, MENU_BAR))
            intervalId = null
            return
          }
          const move = diff > 0 ? Math.min(30, diff) : Math.max(-30, diff)
          await win.setPosition(new LogicalPosition(Math.round(currentX + move), MENU_BAR))
          intervalId = setTimeout(step, 8)
        }
        intervalId = setTimeout(step, 8)
      }

      unlistenBlur = await win.listen('tauri://blur', () => {
        slideTo(screenWidth - 3)
      })

      unlistenFocus = await win.listen('tauri://focus', () => {
        slideTo(screenWidth - winWidth)
      })

      if (aborted) {
        if (intervalId) { clearTimeout(intervalId); intervalId = null }
        unlistenBlur()
        unlistenFocus()
      }
    }

    init()

    return () => {
      aborted = true
      if (intervalId) { clearTimeout(intervalId); intervalId = null }
      if (unlistenBlur) unlistenBlur()
      if (unlistenFocus) unlistenFocus()
    }
  }, [])
}
