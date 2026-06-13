'use client'
import { useEffect } from 'react'

/**
 * Pure slide engine — exported for testing.
 * Returns { slideTo, getCurrentX }.
 * setPosition(x) is called fire-and-forget each tick.
 */
export function makeSlideTo({ startX, setPosition, stepPx = 30, intervalMs = 8 }) {
  let currentX = startX
  let slideToken = 0
  let intervalId = null

  function slideTo(targetX) {
    const token = ++slideToken
    if (intervalId) { clearInterval(intervalId); intervalId = null }

    intervalId = setInterval(() => {
      if (token !== slideToken) { clearInterval(intervalId); return }
      const diff = targetX - currentX
      if (Math.abs(diff) < 2) {
        currentX = targetX
        setPosition(targetX)
        clearInterval(intervalId); intervalId = null
        return
      }
      currentX += diff > 0 ? Math.min(stepPx, diff) : Math.max(-stepPx, diff)
      setPosition(Math.round(currentX))
    }, intervalMs)
  }

  function getCurrentX() { return currentX }

  return { slideTo, getCurrentX }
}

export function useWindowSlide() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return

    let unlistenBlur = null
    let unlistenFocus = null
    let blurTimer = null
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
      const MENU_BAR = 28

      await win.setSize(new LogicalSize(winWidth, screenHeight - MENU_BAR))
      await win.setPosition(new LogicalPosition(screenWidth - winWidth, MENU_BAR))

      const { slideTo } = makeSlideTo({
        startX: screenWidth - winWidth,
        setPosition: (x) => win.setPosition(new LogicalPosition(x, MENU_BAR)),
      })

      unlistenBlur = await win.listen('tauri://blur', () => {
        clearTimeout(blurTimer)
        blurTimer = setTimeout(() => slideTo(screenWidth - 3), 150)
      })

      unlistenFocus = await win.listen('tauri://focus', () => {
        clearTimeout(blurTimer)
        slideTo(screenWidth - winWidth)
      })

      if (aborted) {
        clearTimeout(blurTimer)
        if (unlistenBlur) unlistenBlur()
        if (unlistenFocus) unlistenFocus()
      }
    }

    init()

    return () => {
      aborted = true
      clearTimeout(blurTimer)
      if (unlistenBlur) unlistenBlur()
      if (unlistenFocus) unlistenFocus()
    }
  }, [])
}
