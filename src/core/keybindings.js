/**
 * Rift Keybinding Registry
 *
 * Centralised keyboard shortcut management.  Plugins register combos here
 * instead of adding raw document listeners.  The terminal's
 * attachCustomKeyEventHandler delegates to isRegistered() so registered
 * combos are blocked from reaching the PTY automatically.
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

  let listenerAdded = false

  /**
   * Register a keyboard shortcut.
   * @param {string} combo  - e.g. 'ctrl+p', 'ctrl+shift+n'
   * @param {Function|string} handler - Callback or command ID to execute
   * @returns {Function} Unregister function
   */
  function register(combo, handler) {
    const key = normalize(combo)
    if (registry.has(key)) return () => {}
    registry.set(key, handler)
    ensureListener()
    return () => registry.delete(key)
  }

  /**
   * Unregister a keyboard shortcut.
   * @param {string} combo
   */
  function unregister(combo) {
    registry.delete(normalize(combo))
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
   * Remove all registered keybindings (for testing/teardown).
   */
  function clear() {
    registry.clear()
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

  return { register, unregister, isRegistered, clear }
}

export const keybindings = createKeybindings()