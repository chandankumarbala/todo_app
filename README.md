# Do It

Minimal todo app for macOS. Runs as a native desktop binary or in the browser.

## Features

- Split view — pending tasks on top, completed below
- Double-click blank area to add a task
- Inline editing of task text and deadline date
- Complete or delete any task with one click
- Urgency colours — yellow after 12 PM SGT, red after 4 PM SGT
- Drag to reorder pending tasks
- SGT timezone throughout
- SQLite-backed, persists across restarts
- Frameless window, always on top, 30% screen width, right-aligned
- Slides to screen edge on blur, slides back on focus

## Usage

```bash
npm run dev          # browser dev mode
npm run tauri:dev    # native app dev mode
npm run tauri:build  # build macOS binary
```

## Tech

Next.js 14 · TailwindCSS · SWR · dnd-kit · Express · SQLite · Tauri 2.0
