/**
 * RiftAPI — the complete plugin API surface
 *
 * This module assembles all core modules into a single API object that
 * gets passed to every plugin's `activate(rift)` function.
 *
 * Plugins see:
 *   rift.events      — pub/sub event bus
 *   rift.commands    — command registry
 *   rift.terminal    — PTY + xterm.js control
 *   rift.ui          — UI extensions (buttons, panels, themes)
 *   rift.settings    — persistent settings
 *   rift.api         — raw Tauri IPC escape hatch
 *
 * No plugin should import from src/core/ directly.
 */

import { events } from './event-bus.js'
import { commands } from './commands.js'
import { terminal } from './terminal.js'
import { ui } from './ui-api.js'
import { settings } from './settings.js'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { pluginLoader } from './plugin-loader.js'

/**
 * Create the full RiftAPI object.
 * New instances are created per-plugin to allow sandboxing in the future.
 * @returns {object} api
 */
export function createAPI() {
  return {
    events: {
      on:   (event, fn) => events.on(event, fn),
      once: (event, fn) => events.once(event, fn),
      off:  (event, fn) => events.off(event, fn),
      emit: (event, data) => events.emit(event, data),
    },

    commands: {
      register: (id, def) => commands.register(id, def),
      execute:  (id, ...args) => commands.execute(id, ...args),
      list:     () => commands.list(),
    },

    terminal: {
      open:   (shellPath, shellArgs) => terminal.open(shellPath, shellArgs),
      write:  (data) => terminal.write(data),
      resize: (cols, rows) => terminal.resize(cols, rows),
      close:  () => terminal.close(),
      focus:  () => terminal.focus(),
      getInfo: () => terminal.getInfo(),
      onInput: (fn) => terminal.onInput(fn),
      onData:  (fn) => terminal.onData(fn),
      isActive: () => terminal.isActive(),
    },

    ui: {
      addButton:     (def) => ui.addButton(def),
      removeButton:  (id) => ui.removeButton(id),
      addPanel:      (def) => ui.addPanel(def),
      removePanel:   (id) => ui.removePanel(id),
      togglePanel:   (id) => ui.togglePanel(id),
      showPanel:     (id) => ui.showPanel(id),
      hidePanel:     (id) => ui.hidePanel(id),
      registerTheme: (def) => ui.registerTheme(def),
      applyTheme:    (name) => ui.applyTheme(name),
      getTheme:      (name) => ui.getTheme(name),
      listThemes:    () => ui.listThemes(),
      injectCSS:     (css, id) => ui.injectCSS(css, id),
    },

    settings: {
      get:     (key) => settings.get(key),
      getAll:  () => settings.getAll(),
      set:     (key, value) => settings.set(key, value),
      onChange: (fn) => settings.onChange(fn),
    },

    api: {
      invoke: (cmd, args) => invoke(cmd, args),
      listen: (event, fn) => listen(event, fn),
    },
  }
}

/** Singleton API instance shared by all plugins. */
export const api = createAPI()