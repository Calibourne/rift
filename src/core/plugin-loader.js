/**
 * Rift Plugin Loader
 *
 * Discovers plugins from two sources and activates them:
 *   1. Built-in plugins (bundled by Vite under src/plugins/)
 *   2. User plugins (~/.config/rift/plugins/<name>/)
 *
 * Each plugin receives the full RiftAPI object and calls activate(rift).
 * Errors in one plugin never crash another (try/catch per plugin).
 */

import { invoke } from '@tauri-apps/api/core'
import { events } from './event-bus.js'

function createPluginLoader() {
  const active = new Map()

  /**
   * Load all built-in plugins from pre-collected Vite glob results.
   *
   * mainModules is from Vite's glob import on main.js files.
   * manifestModules is from Vite's glob on manifest.json with eager:true.
   *
   * @param {object} mainModules     - path -> lazy import function
   * @param {object} manifestModules - path -> manifest object
   * @param {object} api             - RiftAPI instance
   */
  async function loadBuiltins(mainModules, manifestModules, api) {
    if (!mainModules || typeof mainModules !== 'object') return

    for (const [mainPath, modPromise] of Object.entries(mainModules)) {
      const m = mainPath.match(/\.\/plugins\/([^/]+)\/main\.js/)
      if (!m) continue

      const pluginName = m[1]
      const manifestPath = `./plugins/${pluginName}/manifest.json`
      const manifest = manifestModules?.[manifestPath]

      try {
        const mod = await modPromise()
        const name = manifest?.name ?? pluginName
        await activate(name, mod, api, manifest)
      } catch (e) {
        console.error(`[plugin-loader] failed to load "${pluginName}":`, e)
      }
    }
  }

  /**
   * Load user plugins from ~/.config/rift/plugins/<name>/.
   * Eager plugins import immediately. Lazy plugins register stubs
   * from their manifest commands — first execution triggers import + activate.
   */
  async function loadUserPlugins(api) {
    let entries
    try {
      entries = await invoke('list_user_plugins')
    } catch (e) {
      console.warn('[plugin-loader] no user plugin dir or IPC unavailable:', e)
      return
    }

    for (const entry of entries) {
      let manifest = null
      if (entry.manifest) {
        try { manifest = JSON.parse(entry.manifest) } catch { /* ignore */ }
      }

      if (manifest && manifest.lazy === true) {
        registerLazyPlugin(entry, manifest, api)
      } else {
        await loadPluginNow(entry, api)
      }
    }
  }

  /**
   * Eager-load a user plugin: import main.js, parse manifest, activate.
   */
  async function loadPluginNow(entry, api) {
    try {
      const blob = new Blob([entry.main], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      const mod = await import(/* @vite-ignore */ url)
      URL.revokeObjectURL(url)
      const manifest = entry.manifest ? JSON.parse(entry.manifest) : null
      await activate(entry.name, mod, api, manifest)
    } catch (e) {
      console.error(`[plugin-loader] failed to load user plugin "${entry.name}":`, e)
    }
  }

  /**
   * Lazy-register a user plugin: only register command stubs from manifest.
   * On first execution, import + activate the real plugin, then delegate.
   */
  function registerLazyPlugin(entry, manifest, api) {
    const contributes = manifest.contributes
    if (!contributes || !contributes.commands || contributes.commands.length === 0) {
      // Nothing to trigger on — force eager load
      loadPluginNow(entry, api)
      return
    }

    let loaded = false
    let mod = null

    async function ensureLoaded() {
      if (loaded) return
      const blob = new Blob([entry.main], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      mod = await import(/* @vite-ignore */ url)
      URL.revokeObjectURL(url)
      const parsedManifest = entry.manifest ? JSON.parse(entry.manifest) : null
      await activate(entry.name, mod, api, parsedManifest)
      loaded = true
    }

    for (const cmd of contributes.commands) {
      const cmdId = cmd.id
      api.commands.register(cmdId, {
        label: cmd.label,
        category: manifest.name || entry.name,
        handler: async (...args) => {
          await ensureLoaded()
          // Re-execute after plugin is active — plugin's register() call
          // will have overwritten our stub with the real handler
          api.commands.execute(cmdId, ...args)
        },
      })
    }
  }

  /**
   * Activate a single plugin.
   * @param {string}   name
   * @param {object}   mod
   * @param {object}   api
   * @param {object}   [manifest]
   */
  async function activate(name, mod, api, manifest) {
    if (active.has(name)) {
      console.warn(`[plugin-loader] "${name}" already active, skipping`)
      return
    }

    // Contributed commands are handled by the plugin's activate() function
    // The manifest declares them, but the plugin registers the real handler.

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

  function isActive(name) {
    return active.has(name)
  }

  function listActive() {
    return [...active.keys()].map(name => ({ name }))
  }

  return { loadBuiltins, loadUserPlugins, activate, deactivate, isActive, listActive }
}

export const pluginLoader = createPluginLoader()