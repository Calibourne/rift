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

  return {
    addButton, removeButton, getButtons,
    addPanel, removePanel, togglePanel, showPanel, hidePanel, getPanel, getPanels,
    registerTheme, applyTheme,
    injectCSS,
  }
}

export const ui = createUI()