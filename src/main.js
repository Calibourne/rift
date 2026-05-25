/**
 * Rift — minimal extensible terminal runtime
 *
 * This is the thin entry point.  It boots core modules, loads plugins,
 * and gets out of the way.  Everything else is a plugin.
 */

import "@xterm/xterm/css/xterm.css"
import "./style.css"

import { settings } from "./core/settings.js"
import { events } from "./core/event-bus.js"
import { commands } from "./core/commands.js"
import { pluginLoader } from "./core/plugin-loader.js"
import { terminal } from "./core/terminal.js"
import { api } from "./core/rift-api.js"

/* ── Boot sequence ── */

async function boot() {
  // 1. Load persisted settings from Rust backend
  await settings.load()

  // 2. Emit core modules are ready
  events.emit("app:ready", {})

  // 3. Register built-in commands (before plugins, so our handlers win)
  commands.register('builtin:close-terminal', {
    label: 'Close Terminal',
    category: 'Built-in',
    handler: async () => {
      if (!terminal.isActive()) return
      await terminal.close()
      // Show a placeholder in the terminal area instead of going back to selector
      const container = document.querySelector('.terminal-container')
      if (container) {
        container.innerHTML = ''
        const placeholder = document.createElement('div')
        placeholder.className = 'terminal-placeholder'
        placeholder.textContent = 'Terminal closed — Ctrl+P to open a new one'
        container.appendChild(placeholder)
      }
    },
  })

  commands.register('builtin:new-terminal', {
    label: 'New Terminal',
    category: 'Built-in',
    handler: async () => {
      const defaultShell = settings.get('default_shell')
      if (!defaultShell || !defaultShell.path) {
        // No default set, show selector
        events.emit('app:phase', 'select')
        return
      }
      const container = document.querySelector('.terminal-container')
      if (!container) {
        events.emit('app:phase', 'terminal')
        // Wait a tick for toolbar to render
        await new Promise(r => setTimeout(r, 0))
      }
      events.emit('app:phase', 'terminal')
      events.emit('shell:selected', defaultShell)
    },
  })

  commands.register('builtin:show-shell-selector', {
    label: 'Show Shell Selector',
    category: 'Built-in',
    handler: async () => {
      if (terminal.isActive()) {
        await terminal.close()
      }
      events.emit('app:phase', 'select')
    },
  })

  // 4. Load built-in plugins (Vite static glob — must be in this file)
  const modules = import.meta.glob("./plugins/*/main.js", { eager: false })
  const manifests = import.meta.glob("./plugins/*/manifest.json", { eager: true, import: "default" })

  // Pass glob results to the plugin loader
  await pluginLoader.loadBuiltins(modules, manifests, api)

  // 5. Load user plugins (from ~/.config/rift/plugins/)
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

  // 7. Start the app
  const defaultShell = settings.get('default_shell')
  if (defaultShell && defaultShell.path) {
    // Auto-launch — have a default, skip the selector
    events.emit('app:phase', 'terminal')
    events.emit('shell:selected', defaultShell)
  } else {
    // No default — show the shell selector (first run)
    events.emit('app:phase', 'select')
  }
}

boot().catch((e) => {
  console.error("Rift boot failed:", e)
  document.getElementById("root").textContent =
    "Boot error: " + String(e)
})