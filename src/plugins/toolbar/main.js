/**
 * @rift/toolbar
 *
 * Renders a toolbar above the terminal with:
 *   - Shell name / tab label
 *   - Plugin buttons (from ui.addButton)
 *   - Close button
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
  let toolbarEl = null
  let tabEl = null
  let rightEl = null

  function render() {
    const root = document.getElementById('root')
    if (!root) return
    root.classList.remove('shell-selector-mode')
    root.classList.add('terminal-mode')

    root.innerHTML = ''

    toolbarEl = h('div', { className: 'terminal-toolbar' })
    tabEl = h('div', { className: 'tab' }, txt('Terminal'))
    rightEl = h('div', { className: 'toolbar-right' })

    toolbarEl.appendChild(tabEl)
    toolbarEl.appendChild(rightEl)

    const container = h('div', { className: 'terminal-container' })

    root.appendChild(toolbarEl)
    root.appendChild(container)

    window.__rift_toolbar = { toolbarEl, tabEl, rightEl, container }
  }

  rift.events.on('shell:selected', (shell) => {
    if (tabEl) tabEl.textContent = shell.name || 'Terminal'
  })

  rift.events.on('app:phase', (phase) => {
    if (phase === 'terminal') render()
  })

  rift.events.on('ui:button-added', (def) => {
    if (!rightEl) return
    const existing = rightEl.querySelector(`[data-btn-id="${def.id}"]`)
    if (existing) existing.remove()
    const btn = h('button', {
      className: 'plugin-btn',
      'data-btn-id': def.id,
      title: def.title || def.label,
      onClick: () => def.onClick && def.onClick(),
    }, txt(def.label))
    rightEl.appendChild(btn)
  })

  rift.events.on('ui:button-removed', ({ id }) => {
    if (!rightEl) return
    const btn = rightEl.querySelector(`[data-btn-id="${id}"]`)
    if (btn) btn.remove()
  })

  window.__rift_getTerminalContainer = () => {
    return window.__rift_toolbar?.container ?? document.querySelector('.terminal-container')
  }
}

export function deactivate() {
  const root = document.getElementById('root')
  if (root) root.classList.remove('terminal-mode')
  delete window.__rift_toolbar
  delete window.__rift_getTerminalContainer
}