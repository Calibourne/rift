/**
 * Rift Event Bus
 *
 * Simple publish/subscribe with wildcard support.
 * Every core module and plugin communicates through this.
 *
 * Usage:
 *   import { events } from './core/event-bus.js'
 *   events.on('pty:data', handler)
 *   events.emit('pty:data', { ptyId, data })
 *   const unsub = events.on('pty:data', handler)  // returns unsubscribe fn
 *   events.once('app:ready', () => ...)            // fires once then auto-removes
 *   events.off('pty:data', handler)                // explicit remove
 */

function createEventBus() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map()

  /**
   * Subscribe to an event.
   * @param {string} event - Event name (e.g. 'pty:data')
   * @param {Function} fn - Callback
   * @returns {Function} Unsubscribe function
   */
  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event).add(fn)
    return () => off(event, fn)
  }

  /**
   * Subscribe to an event once.
   * @param {string} event
   * @param {Function} fn
   * @returns {Function} Unsubscribe function
   */
  function once(event, fn) {
    const wrapper = (...args) => {
      fn(...args)
      off(event, wrapper)
    }
    return on(event, wrapper)
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} fn
   */
  function off(event, fn) {
    const set = listeners.get(event)
    if (set) {
      set.delete(fn)
      if (set.size === 0) listeners.delete(event)
    }
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} event
   * @param {*} data
   */
  function emit(event, data) {
    const set = listeners.get(event)
    if (set) {
      for (const fn of set) {
        try { fn(data) } catch (e) { console.error(`[event-bus] error in "${event}" handler:`, e) }
      }
    }
  }

  /**
   * Remove all listeners (for testing / teardown).
   * @param {string} [event]
   */
  function clear(event) {
    if (event) listeners.delete(event)
    else listeners.clear()
  }

  /** Get number of listeners for an event (debug). */
  function listenerCount(event) {
    return listeners.get(event)?.size ?? 0
  }

  return { on, once, off, emit, clear, listenerCount }
}

export const events = createEventBus()