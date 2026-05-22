/**
 * Aether — minimal extensible terminal runtime
 *
 * This is the thin entry point.  It boots core modules, loads plugins,
 * and gets out of the way.  Everything else is a plugin.
 */

import "@xterm/xterm/css/xterm.css"
import "./style.css"

import { settings } from "./core/settings.js"
import { events } from "./core/event-bus.js"
import { pluginLoader } from "./core/plugin-loader.js"
import { terminal } from "./core/terminal.js"
import { api } from "./core/aether-api.js"

/* ── Boot sequence ── */

async function boot() {
  // 1. Load persisted settings from Rust backend
  await settings.load()

  // 2. Emit core modules are ready
  events.emit("app:ready", {})

  // 3. Load built-in plugins (Vite static glob — must be in this file)
  const modules = import.meta.glob("./plugins/*/main.js", { eager: false })
  const manifests = import.meta.glob("./plugins/*/manifest.json", { eager: true, import: "default" })

  // Pass glob results to the plugin loader
  await pluginLoader.loadBuiltins(modules, manifests, api)

  // 4. Load user plugins (from ~/.config/aether/plugins/)
  await pluginLoader.loadUserPlugins(api)

  // 5. Wire up shell selection -> terminal launch
  // The shell-selector plugin emits 'shell:selected'; we orchestrate
  // the actual PTY launch here so core modules don't need DOM coupling.
  events.on('shell:selected', async (shellInfo) => {
    // Toolbar renders the container synchronously on 'app:phase' -> 'terminal'
    // which fires before this event, so the DOM is ready.
    const container = document.querySelector('.terminal-container')
    if (!container) {
      console.error('[main] no .terminal-container found')
      return
    }
    try {
      await terminal.open(container, shellInfo, {
        fontSize: settings.get('font_size') || 14,
        fontFamily: settings.get('font_family')
          || "'JetBrainsMono Nerd Font','JetBrains Mono','Fira Code',monospace",
      })
    } catch (e) {
      console.error('[main] terminal.open failed:', e)
    }
  })

  // 6. Start the app — show shell selector
  events.emit("app:phase", "select")
}

boot().catch((e) => {
  console.error("Aether boot failed:", e)
  document.getElementById("root").textContent =
    "Boot error: " + String(e)
})