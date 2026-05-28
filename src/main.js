/**
 * Rift — minimal extensible terminal runtime
 *
 * This is the thin entry point.  It boots core modules, loads plugins,
 * and gets out of the way.  Everything else is a plugin.
 */

import "@xterm/xterm/css/xterm.css"
import "./style.css"

import { invoke } from '@tauri-apps/api/core'
import { settings } from "./core/settings.js"
import { events } from "./core/event-bus.js"
import { commands } from "./core/commands.js"
import { pluginLoader } from "./core/plugin-loader.js"
import { terminal } from "./core/terminal.js"
import { keybindings } from "./core/keybindings.js"
import { api } from "./core/rift-api.js"

/* ── Boot sequence ── */

async function boot() {
  // 1. Load persisted settings from Rust backend
  await settings.load()

  // 2. Load user-defined keybindings from settings (before plugins, so user wins)
  keybindings.loadFromSettings(settings)

  // 3. Emit core modules are ready
  events.emit("app:ready", {})

  // 4. Register built-in commands (before plugins, so our handlers win)
  commands.register('builtin:close-terminal', {
    label: 'Close Terminal',
    category: 'Built-in',
    handler: async () => {
      if (!terminal.isActive()) return
      const id = terminal.activeId
      await terminal.close(id)
      if (!terminal.isActive()) {
        // Show a placeholder in the terminal area instead of going back to selector
        const container = document.querySelector('.terminal-container')
        if (container) {
          container.innerHTML = ''
          const placeholder = document.createElement('div')
          placeholder.className = 'terminal-placeholder'
          placeholder.textContent = 'Terminal closed — Ctrl+P to open a new one'
          container.appendChild(placeholder)
        }
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

  // 5. Load built-in plugins (Vite static glob — must be in this file)
  const modules = import.meta.glob("./plugins/*/main.js", { eager: false })
  const manifests = import.meta.glob("./plugins/*/manifest.json", { eager: true, import: "default" })

  // Pass glob results to the plugin loader
  await pluginLoader.loadBuiltins(modules, manifests, api)

  // 6. Load user plugins (from ~/.config/rift/plugins/)
  await pluginLoader.loadUserPlugins(api)

  // 7. Register per-shell commands so they appear in Ctrl+P palette
  //    This replaces the need for a separate shell selector modal.
  try {
    const shells = await invoke('list_shells')
    for (const s of shells) {
      const id = 'shell:' + s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      commands.register(id, {
        label: s.name,
        category: 'Shells',
        handler: () => {
          const info = { name: s.name, path: s.path, args: s.args }
          settings.set('default_shell', info)
          if (terminal.isActive()) terminal.close().then(() => {
            events.emit('app:phase', 'terminal')
            events.emit('shell:selected', info)
          })
          else {
            events.emit('app:phase', 'terminal')
            events.emit('shell:selected', info)
          }
        },
      })
    }
  } catch (e) {
    console.warn('[main] failed to list shells:', e)
  }

  // 8. Wire up shell selection -> terminal launch
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
      await terminal.createAndOpen(container, shellInfo, {
        fontSize: settings.get('font_size') || 14,
        fontFamily: settings.get('font_family')
          || "'JetBrainsMono Nerd Font','JetBrains Mono','Fira Code',monospace",
        scrollback: settings.get('scrollback') || 5000,
      })
    } catch (e) {
      console.error('[main] terminal.createAndOpen failed:', e)
    }
  })

  // 9. Start the app
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