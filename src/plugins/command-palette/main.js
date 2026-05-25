/**
 * @rift/command-palette
 *
 * Ctrl+P overlay that lists all registered commands.
 * Type to filter, Enter to execute, Escape to close.
 */

import './style.css'

const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'className') e.className = v
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v)
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v)
    else e.setAttribute(k, v)
  }
  for (const c of kids) e.append(c)
  return e
}
const txt = (s) => document.createTextNode(s)

export function activate(rift) {
  let overlay = null
  let input = null
  let list = null
  let selectedIndex = 0
  let commands = []

  function open() {
    if (overlay) return

    commands = rift.commands.list()
    selectedIndex = 0

    overlay = h('div', { className: 'command-palette-overlay' },
      h('div', { className: 'command-palette-modal' },
        h('div', { className: 'command-palette-input-wrap' },
          (input = h('input', {
            className: 'command-palette-input',
            type: 'text',
            placeholder: 'Type a command\u2026',
            onKeyDown: handleKeyDown,
            onInput: filterCommands,
          }))
        ),
        (list = h('div', { className: 'command-palette-list' }))
      )
    )

    document.body.appendChild(overlay)
    renderList(commands)
    setTimeout(() => input?.focus(), 50)

    setTimeout(() => {
      document.addEventListener('mousedown', clickOutside, { once: true })
    }, 0)
  }

  function close() {
    if (overlay) {
      overlay.remove()
      overlay = null
      input = null
      list = null
    }
  }

  function clickOutside(e) {
    const modal = overlay?.querySelector('.command-palette-modal')
    if (modal && !modal.contains(e.target)) close()
  }

  function filterCommands() {
    const q = (input?.value || '').toLowerCase()
    const filtered = commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q)
    )
    selectedIndex = 0
    renderList(filtered)
  }

  function renderList(items) {
    if (!list) return
    list.innerHTML = ''
    if (items.length === 0) {
      list.appendChild(h('div', { className: 'command-palette-empty' }, txt('No matching commands')))
      return
    }
    for (let i = 0; i < items.length; i++) {
      const cmd = items[i]
      const item = h('div', {
        className: 'command-palette-item' + (i === selectedIndex ? ' selected' : ''),
        onClick: () => executeCommand(cmd.id),
        onMouseEnter: () => { selectedIndex = i; highlight() },
      },
        h('span', { className: 'cpi-icon' }, txt(cmd.icon || '\u2b50')),
        h('span', { className: 'cpi-label' }, txt(cmd.label)),
        h('span', { className: 'cpi-category' }, txt(cmd.category || '')),
        h('span', { className: 'cpi-id' }, txt(cmd.id))
      )
      list.appendChild(item)
    }
    highlight()
  }

  function highlight() {
    const items = list?.querySelectorAll('.command-palette-item')
    if (!items) return
    items.forEach((el, i) => el.classList.toggle('selected', i === selectedIndex))
    items[selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }

  function handleKeyDown(e) {
    const items = list?.querySelectorAll('.command-palette-item') || []

    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const q = (input?.value || '').toLowerCase()
      const filtered = commands.filter(c =>
        c.label.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q)
      )
      if (filtered[selectedIndex]) {
        executeCommand(filtered[selectedIndex].id)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (selectedIndex < items.length - 1) selectedIndex++
      highlight()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (selectedIndex > 0) selectedIndex--
      highlight()
    }
  }

  function executeCommand(id) {
    close()
    rift.commands.execute(id)
  }

  rift.commands.register('builtin:open-palette', {
    label: 'Open Command Palette',
    category: 'Built-in',
    icon: '\u2318P',
    handler: () => open(),
  })

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault()
      e.stopPropagation()
      open()
    }
  }, true)
}

export function deactivate() {
  close()
}