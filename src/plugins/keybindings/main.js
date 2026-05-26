/**
 * @rift/keybindings
 *
 * Side panel for viewing and editing keyboard shortcuts.
 * Opens via toolbar button. Click any command row, press a combo to bind.
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

// Normalise a KeyboardEvent into a combo string (mirrors keybindings.js)
function normalizeEvent(e) {
  const parts = []
  if (e.ctrlKey || e.metaKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  parts.push(e.key.toLowerCase())
  return parts.join('+')
}

// Render a combo string nicely for display, e.g. 'ctrl+p' -> 'Ctrl+P'
function prettyCombo(combo) {
  if (!combo) return null
  return combo
    .split('+')
    .map(p => p === 'ctrl' ? 'Ctrl' : p.charAt(0).toUpperCase() + p.slice(1))
    .join('+')
}

export function activate(rift) {
  let panelEl = null
  let listEl = null
  let searchEl = null
  let statusEl = null
  /** @type {string|null} */
  let capturing = null
  /** @type {string[]} */
  let savedBindings = []

  // ── Read current keybindings from settings ──
  function loadBindings() {
    const raw = rift.settings.get('keybindings')
    return (raw && typeof raw === 'object') ? raw : {}
  }

  // ── Render the command list ──
  function render() {
    if (!listEl) return
    const filter = (searchEl?.value || '').toLowerCase()
    const commands = rift.commands.list()
    const bindings = loadBindings()

    // Build a map of commandId -> pretty combo string
    const bindingMap = {}
    for (const [combo, cmdId] of Object.entries(bindings)) {
      bindingMap[cmdId] = prettyCombo(combo)
    }

    let shown = commands
    if (filter) {
      shown = commands.filter(c =>
        c.label.toLowerCase().includes(filter) ||
        c.id.toLowerCase().includes(filter) ||
        (c.category || '').toLowerCase().includes(filter)
      )
    }

    // Sort: bound commands first, then alphabetical by category+label
    shown = [...shown].sort((a, b) => {
      const aBound = bindingMap[a.id] ? 0 : 1
      const bBound = bindingMap[b.id] ? 0 : 1
      if (aBound !== bBound) return aBound - bBound
      const cat = (a.category || '').localeCompare(b.category || '')
      if (cat !== 0) return cat
      return a.label.localeCompare(b.label)
    })

    listEl.innerHTML = ''
    if (shown.length === 0) {
      listEl.appendChild(
        h('div', { style: { padding: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--rift-textMuted, #666)' } },
          txt('No matching commands'))
      )
      return
    }

    // Track categories for section headers
    let lastCat = null
    for (const cmd of shown) {
      const cat = cmd.category || ''
      if (cat !== lastCat) {
        lastCat = cat
        listEl.appendChild(
          h('div', { className: 'kb-cat-header', style: {
            padding: '6px 10px 2px',
            fontSize: '0.625rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--rift-textMuted, #888)',
          }}, txt(cat))
        )
      }

      const isCapturing = capturing === cmd.id
      const bound = bindingMap[cmd.id]
      const comboEl = h('span', {
        className: 'kb-combo' + (isCapturing ? ' capturing' : '') + (bound ? '' : ' unbound'),
      }, txt(isCapturing ? 'Press keys\u2026' : (bound || '\u2014')))

      const unbindBtn = h('button', {
        className: 'kb-unbind',
        title: 'Unbind',
        onClick: (e) => {
          e.stopPropagation()
          unbindCombo(cmd.id)
        },
      }, bound ? txt('\u2716') : txt(''))

      const row = h('div', {
        className: 'kb-row' + (isCapturing ? ' capturing' : ''),
        onClick: () => startCapture(cmd.id, row, comboEl),
      },
        h('span', { className: 'kb-cmd-label' }, txt(cmd.label)),
        comboEl,
        unbindBtn,
      )
      listEl.appendChild(row)
    }
  }

  // ── Start capturing a new binding for a command ──
  function startCapture(commandId) {
    if (capturing === commandId) {
      // Toggle off
      capturing = null
      render()
      return
    }

    capturing = commandId

    // Capture keydown on the whole panel
    const handler = (e) => {
      if (e.key === 'Escape') {
        // Cancel
        capturing = null
        render()
        setStatus('')
        document.removeEventListener('keydown', handler, true)
        return
      }

      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        return // ignore modifier-only presses
      }

      e.preventDefault()
      e.stopPropagation()

      const combo = normalizeEvent(e)
      document.removeEventListener('keydown', handler, true)

      // Check conflicts
      const bindings = loadBindings()
      const existingCmd = Object.entries(bindings).find(([c, id]) => c === combo && id !== commandId)

      if (existingCmd) {
        const conflictCmd = rift.commands.list().find(c => c.id === existingCmd[1])
        const label = conflictCmd ? conflictCmd.label : existingCmd[1]
        if (!confirm(`"${prettyCombo(combo)}" is already bound to "${label}". Override?`)) {
          capturing = null
          render()
          return
        }
      }

      // Save binding
      // Remove old binding for this command if exists
      const updated = { ...bindings }
      for (const [c, id] of Object.entries(updated)) {
        if (id === commandId) delete updated[c]
      }
      updated[combo] = commandId
      saveBindings(updated)
      setStatus(`Bound ${prettyCombo(combo)}`, 'saved')
      capturing = null
      render()
    }

    document.addEventListener('keydown', handler, true)
    render()
    setStatus('Press a key combination\u2026')
  }

  // ── Unbind a command ──
  function unbindCombo(commandId) {
    const bindings = loadBindings()
    const updated = { ...bindings }
    for (const [c, id] of Object.entries(updated)) {
      if (id === commandId) {
        delete updated[c]
        rift.keybindings.unregister(c)
      }
    }
    saveBindings(updated)
    setStatus(`Unbound ${commandId}`, 'saved')
  }

  // ── Persist bindings to settings and make live ──
  function saveBindings(bindings) {
    // Persist to settings
    rift.settings.set('keybindings', bindings)
    // Make live by force-registering each binding
    for (const [combo, commandId] of Object.entries(bindings)) {
      rift.keybindings.set(combo, commandId)
    }
  }

  // ── Status bar message ──
  function setStatus(msg, type) {
    if (!statusEl) return
    statusEl.textContent = msg
    statusEl.className = 'kb-status' + (type ? ' ' + type : '')
  }

  // ── Build the panel DOM ──

  searchEl = h('input', {
    className: 'kb-search',
    type: 'text',
    placeholder: 'Search commands\u2026',
    onInput: () => render(),
    onKeyDown: (e) => {
      if (e.key === 'Escape') searchEl.blur()
    },
  })

  listEl = h('div', { className: 'kb-list' })

  statusEl = h('div', { className: 'kb-status' }, txt('Click a command, then press a key combo'))

  panelEl = h('div', { className: 'kb-panel' },
    h('div', { className: 'kb-search-wrap' }, searchEl),
    listEl,
    statusEl,
  )

  // ── Register panel with the UI api ──

  rift.ui.addPanel({
    id: 'keybindings',
    title: 'Keybindings',
    side: 'right',
    element: panelEl,
    icon: '\u2328', // keyboard icon
  })

  // Re-render when command list changes (e.g. shells are registered after boot)
  rift.events.on('plugin:activated', () => render())
  rift.events.on('commands:changed', () => render())

  // Initial render (already registered via settings -> plugins in main.js boot)
  // The toolbar will call rebuildPanel which appends our panel element.
  // render() is called when the panel is first shown via ui:panel-toggled.

  // Render when panel becomes visible
  rift.events.on('ui:panel-toggled', ({ id, visible }) => {
    if (id === 'keybindings' && visible) {
      render()
      setTimeout(() => searchEl?.focus(), 100)
    }
  })

  // Register command to open keybindings
  rift.commands.register('builtin:open-keybindings', {
    label: 'Edit Keybindings',
    category: 'Built-in',
    handler: () => rift.ui.togglePanel('keybindings'),
  })
}

export function deactivate() {
  // Panel content is removed by toolbar on deactivation
}