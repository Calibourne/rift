/**
 * @aether/status-bar
 *
 * Thin status bar at the bottom showing:
 *   - Terminal info (cols x rows)
 *   - Shell name
 *   - Plugin buttons (via ui.getButtons('status-right'))
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
  let bar = null
  let leftEl = null
  let rightEl = null

  function render() {
    const root = document.getElementById('root')
    if (!root) return

    bar = h('div', { className: 'status-bar' })
    leftEl = h('div', { className: 'status-left' })
    rightEl = h('div', { className: 'status-right' })
    bar.appendChild(leftEl)
    bar.appendChild(rightEl)
    root.appendChild(bar)

    updateInfo()
  }

  function updateInfo() {
    if (!leftEl || !rightEl) return
    const info = aether.terminal.getInfo()
    leftEl.textContent = info.shell?.name || 'No shell'
    rightEl.textContent = `${info.cols} x ${info.rows}`
  }

  // Update when terminal info changes
  aether.events.on('pty:resize', () => updateInfo())
  aether.events.on('pty:open', () => updateInfo())
  aether.events.on('pty:exit', () => updateInfo())

  // Show/hide with terminal phase
  aether.events.on('app:phase', (phase) => {
    if (phase === 'terminal') {
      render()
    } else if (bar) {
      bar.remove()
      bar = null
    }
  })
}

export function deactivate() {
  if (bar) bar.remove()
}