/**
 * Rift Keybinding Registry
 *
 * Centralised keyboard shortcut management.  Plugins register combos here
 * instead of adding raw document listeners.  The terminal's
 * attachCustomKeyEventHandler delegates to isRegistered() so registered
 * combos are blocked from reaching the PTY automatically.
 *
 * User-defined keybindings are loaded from settings before plugins
 * activate, so user settings always win.
 *
 * Usage:
 *   import { keybindings } from './core/keybindings.js'
 *   keybindings.register('ctrl+p', () => openPalette())
 *   keybindings.register('ctrl+shift+n', 'builtin:new-terminal')
 *   keybindings.unregister('ctrl+p')
 *
 * Combo format: modifiers + key, joined by '+', case-insensitive.
 *   'ctrl+p', 'ctrl+shift+n', 'alt+enter', 'ctrl+alt+del'
 */

import { commands } from './commands.js'

function normalize(combo) {
  return combo.toLowerCase().replace(/\s+/g, '')
}

function normalizeEvent(e) {
  const parts = []
  if (e.ctrlKey || e.metaKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  parts.push(e.key.toLowerCase())
  return parts.join('+')
}

function createKeybindings() {
  /** @type {Map<string, Function|string>} */
  const registry = new Map()

  /** @type {Map<string, string>} commandId -> combo (reverse lookup) */
  const byCommand = new Map()

  let listenerAdded = false

  /**
   * Register a keyboard shortcut.
   * First-registered wins (user settings are loaded before plugins).
   * @param {string} combo  - e.g. 'ctrl+p', 'ctrl+shift+n'
   * @param {Function|string} handler - Callback or command ID to execute
   * @returns {Function} Unregister function
   */
  function register(combo, handler) {
    const key = normalize(combo)
    if (registry.has(key)) return () => {}
    registry.set(key, handler)
    if (typeof handler === 'string') byCommand.set(handler, key)
    ensureListener()
    return () => { unregister(combo) }
  }

  /**
   * Register or overwrite a keyboard shortcut (used by settings reload).
   * Unlike register(), this always wins — no first-wins check.
   */
  function set(combo, handler) {
    const key = normalize(combo)
    const oldHandler = registry.get(key)
    if (typeof oldHandler === 'string') byCommand.delete(oldHandler)
    registry.set(key, handler)
    if (typeof handler === 'string') byCommand.set(handler, key)
    ensureListener()
    return () => { unregister(combo) }
  }

  /**
   * Unregister a keyboard shortcut.
   * @param {string} combo
   */
  function unregister(combo) {
    const key = normalize(combo)
    const handler = registry.get(key)
    if (typeof handler === 'string') byCommand.delete(handler)
    registry.delete(key)
  }

  /**
   * Check if a keyboard event matches a registered combo.
   * Used by terminal.js — if true, the event is blocked from the PTY.
   * @param {KeyboardEvent} e
   * @returns {boolean}
   */
  function isRegistered(e) {
    return registry.has(normalizeEvent(e))
  }

  /**
   * Remove all registered keybindings.
   */
  function clear() {
    registry.clear()
    byCommand.clear()
  }

  /**
   * Return all combo->command bindings (for the keybindings editor).
   * @returns {Array<{combo: string, commandId: string}>}
   */
  function getBindings() {
    return [...registry.entries()]
      .filter(([, h]) => typeof h === 'string')
      .map(([combo, commandId]) => ({ combo, commandId }))
  }

  /**
   * Look up the combo bound to a command ID.
   * @param {string} commandId
   * @returns {string|undefined}
   */
  function getCombo(commandId) {
    return byCommand.get(commandId)
  }

  /**
   * Load user-defined keybindings from persisted settings.
   * Called during boot, before plugins activate, so user settings win.
   *
   * Settings format:
   *   { "ctrl+p": "builtin:show-shell-selector", "ctrl+w": null }
   *
   * A null value blocks that combo — no plugin can claim it.
   *
   * @param {object} riftSettings - settings module with get() method
   */
  function loadFromSettings(riftSettings) {
    const bindings = riftSettings.get('keybindings')
    if (!bindings || typeof bindings !== 'object') return
    for (const [combo, commandId] of Object.entries(bindings)) {
      if (commandId === null || commandId === '') {
        // Block this combo — set no-op so plugins can't claim it
        set(combo, () => {})
      } else if (typeof commandId === 'string') {
        set(combo, commandId)
      }
    }
  }

  // Lazy-add one capture-phase listener on first registration.
  // This catches all keydowns before they reach xterm.js.
  function ensureListener() {
    if (listenerAdded) return
    document.addEventListener('keydown', (e) => {
      const combo = normalizeEvent(e)
      const handler = registry.get(combo)
      if (!handler) return
      e.preventDefault()
      e.stopPropagation()
      if (typeof handler === 'string') {
        commands.execute(handler)
      } else {
        handler(e)
      }
    }, true) // capture phase — fires before xterm sees the event
    listenerAdded = true
  }

  return { register, set, unregister, isRegistered, clear, loadFromSettings, getBindings, getCombo }
}

export const keybindings = createKeybindings()