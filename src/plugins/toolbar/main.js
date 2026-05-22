/**
 * @aether/toolbar
 *
 * Renders a toolbar above the terminal with:
 *   - Shell name / tab label
 *   - Programmatic buttons (from ui.addButton)
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

export function activate(aether) {
  let toolbarEl = null
  let tabEl = null
  let rightEl = null

  function render() {
    const root = document.getElementById('root')
    if (!root) return
    root.classList.remove('shell-selector-mode')
    root.classList.add('terminal-mode')

    // Clear root but keep existing layout
    root.innerHTML = ''

    toolbarEl = h('div', { className: 'terminal-toolbar' })
    tabEl = h('div', { className: 'tab' }, txt('Terminal'))
    rightEl = h('div', { className: 'toolbar-right' })

    toolbarEl.appendChild(tabEl)
    toolbarEl.appendChild(rightEl)

    // Container for terminal
    const container = h('div', { className: 'terminal-container' })

    // Settings panel (hidden by default, toggled by settings plugin)
    const settingsPanel = h('div', {
      className: 'terminal-settings-panel',
      style: { display: 'none' },
    })

    root.appendChild(toolbarEl)
    root.appendChild(settingsPanel)
    root.appendChild(container)

    // Store references for other plugins
    window.__aether_toolbar = { toolbarEl, tabEl, rightEl, settingsPanel, container }
  }

  // When a shell is selected, update the tab label
  aether.events.on('shell:selected', (shell) => {
    if (tabEl) tabEl.textContent = shell.name || 'Terminal'
  })

  // When phase changes to terminal, render toolbar
  aether.events.on('app:phase', (phase) => {
    if (phase === 'terminal') render()
  })

  // Render toolbar elements when buttons are added
  aether.events.on('ui:button-added', (def) => {
    if (!rightEl) return
    // Remove existing button with same id if present
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

  aether.events.on('ui:button-removed', ({ id }) => {
    if (!rightEl) return
    const btn = rightEl.querySelector(`[data-btn-id="${id}"]`)
    if (btn) btn.remove()
  })

  // Expose the terminal container for core/terminal.js
  window.__aether_getTerminalContainer = () => {
    return window.__aether_toolbar?.container ?? document.querySelector('.terminal-container')
  }

  // Expose settings panel for settings plugin
  window.__aether_getSettingsPanel = () => {
    return window.__aether_toolbar?.settingsPanel ?? null
  }
}

export function deactivate() {
  const root = document.getElementById('root')
  if (root) root.classList.remove('terminal-mode')
  delete window.__aether_toolbar
  delete window.__aether_getTerminalContainer
  delete window.__aether_getSettingsPanel
}