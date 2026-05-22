/**
 * Aether Settings Manager
 *
 * Wraps the Rust-backed `get_settings` / `update_settings` IPC commands and
 * adds change events.  Plugins read and write settings through this — they
 * never call `invoke('get_settings')` directly.
 *
 * Usage:
 *   import { settings } from './core/settings.js'
 *   await settings.load()
 *   settings.get('font_size')       // 14
 *   settings.set('font_size', 16)   // persists + emits 'settings:changed'
 *   settings.onChange((key, val) => ...)
 */

import { invoke } from '@tauri-apps/api/core'
import { events } from './event-bus.js'

const DEFAULTS = {
  font_family: "'JetBrainsMono Nerd Font','JetBrains Mono','Fira Code',monospace",
  font_size: 14,
}

function createSettings() {
  /** @type {Record<string, any>} */
  let store = { ...DEFAULTS }

  /** @type {Set<Function>} */
  const changeHandlers = new Set()

  /**
   * Load settings from disk (Tauri backend).
   * Must be called once at boot before reading settings.
   */
  async function load() {
    try {
      const saved = await invoke('get_settings')
      store = { ...DEFAULTS, ...saved }
    } catch {
      store = { ...DEFAULTS }
    }
  }

  /**
   * Get a setting value.
   * @param {string} key
   * @returns {any}
   */
  function get(key) {
    return store[key]
  }

  /**
   * Get all settings as a plain object.
   * @returns {Record<string, any>}
   */
  function getAll() {
    return { ...store }
  }

  /**
   * Set a setting value and persist to disk.
   * @param {string} key
   * @param {any} value
   */
  async function set(key, value) {
    store[key] = value
    // Emit before persisting so plugins can react
    events.emit('settings:changed', { key, value })
    for (const fn of changeHandlers) {
      try { fn(key, value) } catch (e) { console.error('[settings] onChange error:', e) }
    }
    // Persist to Rust backend
    try {
      await invoke('update_settings', { settings: { ...store } })
    } catch (e) {
      console.error('[settings] persist failed:', e)
    }
  }

  /**
   * React to any setting change.
   * @param {Function} fn - Callback(key, value)
   * @returns {Function} Unsubscribe
   */
  function onChange(fn) {
    changeHandlers.add(fn)
    return () => changeHandlers.delete(fn)
  }

  /**
   * Reset a single key to default.
   * @param {string} key
   */
  async function reset(key) {
    if (key in DEFAULTS) await set(key, DEFAULTS[key])
  }

  /**
   * Reset all settings to defaults.
   */
  async function resetAll() {
    for (const key of Object.keys(DEFAULTS)) {
      await set(key, DEFAULTS[key])
    }
  }

  return { load, get, getAll, set, onChange, reset, resetAll }
}

export const settings = createSettings()