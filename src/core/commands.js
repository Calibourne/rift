/**
 * Rift Command Registry
 *
 * Plugins register commands here.  The command palette (a built-in plugin)
 * displays them.  Any plugin can also execute commands programmatically.
 *
 * Usage:
 *   import { commands } from './core/commands.js'
 *   commands.register('my-plugin:hello', {
 *     label: 'Say Hello',
 *     category: 'My Plugin',
 *     handler: () => rift.terminal.write('hi!\n')
 *   })
 *   commands.execute('builtin:quick-settings')
 *   commands.list()  // [{ id, label, category }]
 */

function createCommandRegistry() {
  /** @type {Map<string, { id: string, label: string, category?: string, icon?: string, handler: Function }>} */
  const registry = new Map()

  /**
   * Register a command.
   * @param {string} id - Unique command ID (e.g. 'my-plugin:hello')
   * @param {object} def
   * @param {string} def.label - Display name in command palette
   * @param {string} [def.category] - Grouping category
   * @param {string} [def.icon] - Emoji or icon class
   * @param {Function} def.handler - Called when command is executed
   * @returns {Function} Unregister function
   */
  function register(id, def) {
    if (registry.has(id)) {
      // Don't overwrite — first registration wins
      return () => {}
    }
    registry.set(id, { id, ...def })
    return () => registry.delete(id)
  }

  /**
   * Execute a command by ID.
   * @param {string} id
   * @param {...any} args - Passed through to handler
   */
  function execute(id, ...args) {
    const cmd = registry.get(id)
    if (!cmd) {
      console.warn(`[commands] unknown command "${id}"`)
      return
    }
    try {
      cmd.handler(...args)
    } catch (e) {
      console.error(`[commands] error executing "${id}":`, e)
    }
  }

  /**
   * List all registered commands (for the palette).
   * @returns {Array<{ id: string, label: string, category?: string, icon?: string }>}
   */
  function list() {
    return [...registry.values()].map(({ id, label, category, icon }) => ({ id, label, category, icon }))
  }

  /**
   * Check if a command exists.
   * @param {string} id
   */
  function has(id) {
    return registry.has(id)
  }

  /**
   * Remove all commands (for testing / teardown).
   */
  function clear() {
    registry.clear()
  }

  return { register, execute, list, has, clear }
}

export const commands = createCommandRegistry()