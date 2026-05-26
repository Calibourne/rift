/**
 * Rift UI Extension API
 *
 * Manages toolbar buttons, side panels, and theme injection.
 * Plugins add UI elements through this — they never manipulate the DOM
 * directly (except for their own panel content).
 *
 * Usage:
 *   import { ui } from './core/ui-api.js'
 *   ui.addButton({ position: 'toolbar', id: 'my-btn', label: '🔍', onClick })
 *   ui.addPanel({ id: 'my-panel', title: 'My Panel', side: 'right', element })
 *   ui.registerTheme({ name: 'dark', colors: { background: '#000', ... } })
 *   ui.applyTheme('dark')
 */

import { events } from './event-bus.js'

function createUI() {
  /** @type {Map<string, { id: string, position: string, label: string, title?: string, onClick?: Function }>} */
  const buttons = new Map()

  /** @type {Map<string, { id: string, title: string, side: string, element: HTMLElement, visible: boolean }>} */
  const panels = new Map()

  /** @type {Map<string, object>} */
  const themes = new Map()

  /**
   * Add a button to the toolbar or status bar.
   * @param {object} def
   * @param {string} def.id - Unique button ID
   * @param {'toolbar'|'status-left'|'status-right'} def.position
   * @param {string} def.label - Button text or emoji
   * @param {string} [def.title] - Tooltip text
   * @param {Function} [def.onClick]
   */
  function addButton(def) {
    buttons.set(def.id, def)
    events.emit('ui:button-added', def)
    // The toolbar plugin listens for this event and renders the button
  }

  /**
   * Remove a button.
   * @param {string} id
   */
  function removeButton(id) {
    buttons.delete(id)
    events.emit('ui:button-removed', { id })
  }

  /**
   * Get all buttons in a position.
   * @param {string} position
   * @returns {Array}
   */
  function getButtons(position) {
    return [...buttons.values()].filter(b => b.position === position)
  }

  /**
   * Add a side panel.
   * @param {object} def
   * @param {string} def.id
   * @param {string} def.title - Panel header text
   * @param {'left'|'right'} def.side
   * @param {HTMLElement} def.element - Panel content
   * @param {number} [def.minWidth]
   */
  function addPanel(def) {
    panels.set(def.id, { ...def, visible: false })
    events.emit('ui:panel-added', def)
  }

  /**
   * Remove a panel.
   * @param {string} id
   */
  function removePanel(id) {
    panels.delete(id)
    events.emit('ui:panel-removed', { id })
  }

  /**
   * Toggle a panel's visibility.
   * @param {string} id
   */
  function togglePanel(id) {
    const panel = panels.get(id)
    if (!panel) return
    panel.visible = !panel.visible
    events.emit('ui:panel-toggled', { id, visible: panel.visible })
  }

  /**
   * Show a panel.
   * @param {string} id
   */
  function showPanel(id) {
    const panel = panels.get(id)
    if (!panel) return
    panel.visible = true
    events.emit('ui:panel-toggled', { id, visible: true })
  }

  /**
   * Hide a panel.
   * @param {string} id
   */
  function hidePanel(id) {
    const panel = panels.get(id)
    if (!panel) return
    panel.visible = false
    events.emit('ui:panel-toggled', { id, visible: false })
  }

  /**
   * Get panel state.
   * @param {string} id
   * @returns {object|undefined}
   */
  function getPanel(id) {
    return panels.get(id)
  }

  /**
   * Get all panels on a side.
   * @param {string} side
   * @returns {Array}
   */
  function getPanels(side) {
    return [...panels.values()].filter(p => p.side === side)
  }

  /**
   * Register a theme (color scheme).
   * @param {object} def
   * @param {string} def.name
   * @param {object} def.colors - xterm.js theme map + CSS variables
   */
  function registerTheme(def) {
    themes.set(def.name, def)
    events.emit('ui:theme-registered', { name: def.name })
  }

  /**
   * Apply a registered theme.
   * Injects CSS custom properties on :root and updates xterm theme.
   * @param {string} name
   */
  function applyTheme(name) {
    const theme = themes.get(name)
    if (!theme) {
      console.warn(`[ui] unknown theme "${name}"`)
      return
    }
    const { colors } = theme
    // Set CSS custom properties
    const root = document.documentElement
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(`--rift-${key}`, value)
    }
    events.emit('theme:applied', { name, colors })
  }

  /**
   * Inject a stylesheet into the page.
   * Used by plugin-loader to inject plugin CSS files.
   * @param {string} cssText
   * @param {string} [id] - Unique ID to prevent duplicates
   */
  function injectCSS(cssText, id) {
    if (id && document.getElementById(id)) return
    const style = document.createElement('style')
    if (id) style.id = id
    style.textContent = cssText
    document.head.appendChild(style)
  }

  function getTheme(name) {
    return themes.get(name) || null
  }

  function listThemes() {
    return [...themes.keys()]
  }

  // ── Toast notifications ──

  /** @type {HTMLElement | null} */
  let toastContainer = null

  function ensureToastContainer() {
    if (toastContainer) return
    toastContainer = document.createElement('div')
    toastContainer.className = 'rift-toast-container'
    document.body.appendChild(toastContainer)
  }

  /**
   * Show a transient notification.
   * @param {string} message
   * @param {object} [options]
   * @param {'info'|'success'|'warning'|'error'} [options.type='info']
   * @param {number} [options.duration=3000] - ms, 0 = sticky (manual dismiss)
   * @returns {Function} dismiss function
   */
  function notify(message, options = {}) {
    const { type = 'info', duration = 3000 } = options
    ensureToastContainer()

    const toast = document.createElement('div')
    toast.className = `rift-toast rift-toast-${type}`
    toast.textContent = message

    const close = document.createElement('button')
    close.className = 'rift-toast-close'
    close.textContent = '\u00d7'
    close.addEventListener('click', () => dismiss())
    toast.appendChild(close)

    toastContainer.appendChild(toast)

    // Trigger enter animation
    requestAnimationFrame(() => toast.classList.add('rift-toast-enter'))

    function dismiss() {
      toast.classList.remove('rift-toast-enter')
      toast.classList.add('rift-toast-exit')
      setTimeout(() => toast.remove(), 200)
    }

    if (duration > 0) {
      setTimeout(dismiss, duration)
    }

    return dismiss
  }

  // Inject notification styles once
  injectCSS(
`.rift-toast-container {
  position: fixed;
  bottom: 44px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
}
.rift-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--rift-foreground, #d0d0d0);
  background: var(--rift-surface, #1a1a2e);
  border: 1px solid var(--rift-border, #334);
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  pointer-events: auto;
  transition: opacity 0.2s, transform 0.2s;
  opacity: 0;
  transform: translateY(8px);
}
.rift-toast.rift-toast-enter {
  opacity: 1;
  transform: translateY(0);
}
.rift-toast.rift-toast-exit {
  opacity: 0;
  transform: translateY(-4px);
}
.rift-toast-success { border-left: 3px solid var(--rift-green, #81c784); }
.rift-toast-warning { border-left: 3px solid var(--rift-yellow, #ffd54f); }
.rift-toast-error   { border-left: 3px solid var(--rift-red, #e57373); }
.rift-toast-info    { border-left: 3px solid var(--rift-blue, #64b5f6); }
.rift-toast-close {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--rift-dim, #777);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}
.rift-toast-close:hover { color: var(--rift-foreground, #d0d0d0); }
`,
    'rift-toast-styles'
  )

  return {
    addButton, removeButton, getButtons,
    addPanel, removePanel, togglePanel, showPanel, hidePanel, getPanel, getPanels,
    registerTheme, applyTheme, getTheme, listThemes,
    injectCSS, notify,
  }
}

export const ui = createUI()