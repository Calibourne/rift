/**
 * Aether Plugin Loader
 *
 * Discovers plugins from two sources and activates them:
 *   1. Built-in plugins (bundled by Vite under src/plugins/)
 *   2. User plugins (~/.config/aether/plugins/<name>/)
 *
 * Each plugin receives the full AetherAPI object and calls activate(aether).
 * Errors in one plugin never crash another (try/catch per plugin).
 *
 * Usage:
 *   import { pluginLoader } from './core/plugin-loader.js'
 *   import { api } from './core/aether-api.js'
 *   await pluginLoader.loadBuiltins(import.meta.glob, api)
 *   await pluginLoader.loadUserPlugins(api)
 */

import { commands } from './commands.js'
import { ui } from './ui-api.js'
import { events } from './event-bus.js'

/** Built-in plugin manifests — loaded at compile time via Vite glob */
const BUILTIN_PLUGINS = [
  { name: '@aether/shell-selector', dir: './plugins/shell-selector/' },
  { name: '@aether/settings',       dir: './plugins/settings/' },
  { name: '@aether/toolbar',        dir: './plugins/toolbar/' },
  { name: '@aether/command-palette',dir: './plugins/command-palette/' },
  { name: '@aether/status-bar',     dir: './plugins/status-bar/' },
  { name: '@aether/default-theme',  dir: './plugins/default-theme/' },
]

function createPluginLoader() {
  /** @type {Map<string, { name: string, module: any, api: object }>} */
  const active = new Map()

  /**
   * Load all built-in plugins using Vite's import.meta.glob.
   * Each plugin dir must have main.js and manifest.json.
   * @param {Function} globFn - import.meta.glob result
   * @param {object} api - AetherAPI instance
   */
  async function loadBuiltins(globFn, api) {
    if (!globFn || typeof globFn !== 'function') return

    // Gather all main.js files from src/plugins/
    const modules = globFn('./plugins/*/main.js', { eager: false })
    const manifests = globFn('./plugins/*/manifest.json', { eager: true, import: 'default' })

    for (const plugin of BUILTIN_PLUGINS) {
      const mainPath = `${plugin.dir}main.js`
      const manifestPath = `${plugin.dir}manifest.json`

      const modPromise = modules[mainPath]
      const manifest = manifests[manifestPath]

      if (!modPromise) {
        console.warn(`[plugin-loader] built-in "${plugin.name}" has no main.js at ${mainPath}`)
        continue
      }

      try {
        const mod = await modPromise()
        const name = manifest?.name ?? plugin.name
        await activate(name, mod, api, manifest)
      } catch (e) {
        console.error(`[plugin-loader] failed to load built-in "${plugin.name}":`, e)
      }
    }
  }

  /**
   * Load user plugins from ~/.config/aether/plugins/<name>/.
   * (Uses Tauri IPC to read the directory, or fetch for web dev.)
   * @param {object} api - AetherAPI instance
   */
  async function loadUserPlugins(api) {
    // Phase 3 implementation — Tauri fs plugin or similar
    // For now, this is a no-op placeholder
  }

  /**
   * Activate a single plugin.
   * @param {string} name
   * @param {object} mod - The module (must export activate function)
   * @param {object} api - AetherAPI instance
   * @param {object} [manifest]
   */
  async function activate(name, mod, api, manifest) {
    if (active.has(name)) {
      console.warn(`[plugin-loader] "${name}" already active, skipping`)
      return
    }

    // Register contributed commands
    if (manifest?.contributes?.commands) {
      for (const cmd of manifest.contributes.commands) {
        if (!commands.has(cmd.id)) {
          commands.register(cmd.id, {
            label: cmd.label,
            category: manifest.name ?? name,
            icon: cmd.icon,
            handler: () => commands.execute(cmd.id),
          })
        }
      }
    }

    // Call activate
    if (typeof mod.activate === 'function') {
      try {
        mod.activate(api)
      } catch (e) {
        console.error(`[plugin-loader] error activating "${name}":`, e)
        return
      }
    }

    active.set(name, { name, module: mod, api })
    events.emit('plugin:activated', { name })
  }

  /**
   * Deactivate a plugin (calls its deactivate export if present).
   * @param {string} name
   */
  async function deactivate(name) {
    const entry = active.get(name)
    if (!entry) return
    if (typeof entry.module.deactivate === 'function') {
      try { await entry.module.deactivate() } catch (e) {
        console.error(`[plugin-loader] error deactivating "${name}":`, e)
      }
    }
    active.delete(name)
    events.emit('plugin:deactivated', { name })
  }

  /**
   * Check if a plugin is active.
   * @param {string} name
   */
  function isActive(name) {
    return active.has(name)
  }

  /**
   * List active plugins.
   * @returns {Array<{ name: string }>}
   */
  function listActive() {
    return [...active.keys()].map(name => ({ name }))
  }

  return { loadBuiltins, loadUserPlugins, activate, deactivate, isActive, listActive }
}

export const pluginLoader = createPluginLoader()