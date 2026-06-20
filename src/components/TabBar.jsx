'use client'
import { useState } from 'react'

export default function TabBar({ tabs, activeTabId, onSelect, onAdd, onRename, onDelete }) {
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  function startEdit(tab, e) {
    e.stopPropagation()
    setEditingId(tab.id)
    setEditName(tab.name)
  }

  function commitEdit(id) {
    if (editName.trim()) onRename(id, editName.trim())
    setEditingId(null)
  }

  function handleDelete(e, tab) {
    e.stopPropagation()
    onDelete(tab.id)
  }

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0"
      style={{ WebkitAppRegion: 'no-drag' }}
      onMouseDown={e => e.stopPropagation()}
    >
      {tabs.map(tab => (
        <div
          key={tab.id}
          data-testid={`tab-${tab.id}`}
          className={`group relative flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer select-none whitespace-nowrap shrink-0 ${
            tab.id === activeTabId
              ? 'bg-gray-600 text-gray-100'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }`}
          onClick={() => onSelect(tab.id)}
          onDoubleClick={e => startEdit(tab, e)}
        >
          {editingId === tab.id ? (
            <input
              autoFocus
              data-testid="tab-name-input"
              className="bg-transparent border-b border-blue-400 outline-none text-xs w-20"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={() => commitEdit(tab.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit(tab.id)
                if (e.key === 'Escape') setEditingId(null)
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span>{tab.name}</span>
          )}
          <button
            data-testid={`delete-tab-${tab.id}`}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity ml-0.5 text-xs leading-none"
            onPointerDown={e => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation() }}
            onClick={e => handleDelete(e, tab)}
            title="Delete tab"
          >×</button>
        </div>
      ))}

      <button
        data-testid="add-tab-button"
        onClick={onAdd}
        disabled={tabs.length >= 10}
        className="text-gray-600 hover:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed text-lg leading-none shrink-0 px-1"
        style={{ WebkitAppRegion: 'no-drag' }}
        title={tabs.length >= 10 ? 'Maximum 10 tabs' : 'Add tab'}
        onPointerDown={e => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation() }}
      >+</button>
    </div>
  )
}
