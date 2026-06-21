import React from 'react'
import { render, screen } from '@testing-library/react'
import TabBar from '../TabBar'

const noop = () => {}

const baseTabs = [
  { id: 1, name: 'Tasks', pending_count: 3 },
  { id: 2, name: 'Work', pending_count: 0 },
  { id: 3, name: 'Learning', pending_count: 1 },
]

test('shows [N] badge when pending_count > 0', () => {
  render(<TabBar tabs={baseTabs} activeTabId={1} onSelect={noop} onAdd={noop} onRename={noop} onDelete={noop} />)
  expect(screen.getByTestId('tab-1')).toHaveTextContent('Tasks [3]')
  expect(screen.getByTestId('tab-3')).toHaveTextContent('Learning [1]')
})

test('hides badge when pending_count is 0', () => {
  render(<TabBar tabs={baseTabs} activeTabId={1} onSelect={noop} onAdd={noop} onRename={noop} onDelete={noop} />)
  expect(screen.getByTestId('tab-2')).toHaveTextContent('Work')
  expect(screen.getByTestId('tab-2').textContent).not.toMatch(/\[/)
})

test('hides badge when pending_count is undefined', () => {
  const tabs = [{ id: 1, name: 'Tasks' }]
  render(<TabBar tabs={tabs} activeTabId={1} onSelect={noop} onAdd={noop} onRename={noop} onDelete={noop} />)
  expect(screen.getByTestId('tab-1').textContent).not.toMatch(/\[/)
})
