'use client'
import { useState } from 'react'
import { todaySGT } from '@/utils/sgt'

export default function NewTaskRow({ onCreate, onCancel }) {
  const [text, setText] = useState('')
  const [deadline, setDeadline] = useState(todaySGT())

  function submit() {
    if (!text.trim()) { onCancel(); return }
    onCreate(text.trim(), deadline || null)
  }

  function handleBlur(e) {
    // Only submit if focus leaves the entire row (not just moves to date input)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      submit()
    }
  }

  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 mb-1 rounded border border-blue-500 bg-gray-700"
      onBlur={handleBlur}
    >
      <span className="text-gray-500 px-1 text-xs">⠿</span>
      <input
        autoFocus
        placeholder="New task..."
        className="flex-1 bg-transparent outline-none text-sm text-gray-100 placeholder-gray-500"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') onCancel()
        }}
      />
      <input
        type="date"
        min={todaySGT()}
        className="text-xs bg-gray-600 text-gray-100 border border-gray-500 rounded px-1"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
      />
    </div>
  )
}
