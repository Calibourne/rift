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
  let terminalContainer = null
  let root = null

  // Panel state: id -> { def, panelEl, toggleBtn }
  const panels = new Map()
  let leftPanelContainer = null
  let rightPanelContainer = null

  function render() {
    root = document.getElementById('root')
    if (!root) return
    root.classList.remove('shell-selector-mode')
    root.classList.add('terminal-mode')

    root.innerHTML = ''

    // ── Toolbar ──
    toolbarEl = h('div', { className: 'terminal-toolbar' })
    tabEl = h('div', { className: 'tab' }, txt('Terminal'))
    rightEl = h('div', { className: 'toolbar-right' })
    toolbarEl.appendChild(tabEl)
    toolbarEl.appendChild(rightEl)

    // ── Terminal area (with side panels) ──
    const termArea = h('div', { className: 'terminal-area' })
    leftPanelContainer = h('div', { className: 'side-panel side-panel-left', style: { display: 'none' } })
    terminalContainer = h('div', { className: 'terminal-container' })
    rightPanelContainer = h('div', { className: 'side-panel side-panel-right', style: { display: 'none' } })
    termArea.appendChild(leftPanelContainer)
    termArea.appendChild(terminalContainer)
    termArea.appendChild(rightPanelContainer)

    root.appendChild(toolbarEl)
    root.appendChild(termArea)

    window.__rift_toolbar = { toolbarEl, tabEl, rightEl, container: terminalContainer }

    // Re-apply any registered panels
    for (const p of rift.ui.getPanels('left')) rebuildPanel(p)
    for (const p of rift.ui.getPanels('right')) rebuildPanel(p)
  }

  function rebuildPanel(def) {
    if (!rightPanelContainer) return

    // Remove old panel DOM if exists
    const old = panels.get(def.id)
    if (old) {
      old.panelEl?.remove()
      old.toggleBtn?.remove()
    }

    const panelEl = h('div', {
      className: 'side-panel-content',
      id: 'panel-' + def.id,
      style: { display: def.visible ? 'flex' : 'none' },
    },
      h('div', { className: 'panel-header' },
        h('span', { className: 'panel-title' }, txt(def.title || def.id)),
        h('button', {
          className: 'panel-close',
          onClick: () => { rift.ui.hidePanel(def.id); updateVisibility(def.id) },
        }, txt('\u00d7')),
      ),
      def.element,
    )

    const container = def.side === 'left' ? leftPanelContainer : rightPanelContainer
    if (container) container.appendChild(panelEl)

    // Toggle button in toolbar
    const toggleBtn = h('button', {
      className: 'plugin-btn' + (def.visible ? ' active' : ''),
      title: 'Toggle ' + (def.title || def.id),
      onClick: () => { rift.ui.togglePanel(def.id); updateVisibility(def.id) },
    }, txt(def.icon || '\u2756'))
    if (rightEl) rightEl.prepend(toggleBtn)

    panels.set(def.id, { def, panelEl, toggleBtn })

    // Show/hide the side container if any panel is open
    updateVisibility(def.id)
  }

  function updateVisibility(id) {
    const p = panels.get(id)
    if (!p) return
    p.panelEl.style.display = p.def.visible ? 'flex' : 'none'
    if (p.toggleBtn) p.toggleBtn.classList.toggle('active', p.def.visible)

    // Show/hide the side container if any panel on that side is visible
    const container = p.def.side === 'left' ? leftPanelContainer : rightPanelContainer
    if (!container) return
    const sideHasVisible = [...panels.values()].some(pp => pp.def.side === p.def.side && pp.def.visible)
    container.style.display = sideHasVisible ? 'flex' : 'none'
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

  rift.events.on('ui:panel-added', (def) => {
    if (def.side !== 'left' && def.side !== 'right') return
    rebuildPanel(def)
  })

  rift.events.on('ui:panel-toggled', ({ id, visible }) => {
    const p = panels.get(id)
    if (!p) return
    p.def.visible = visible
    updateVisibility(id)
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