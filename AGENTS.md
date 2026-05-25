# Rift — AGENTS.md

**Rift** is a minimal terminal runtime. Thin core, plugin everything.

## Philosophy

- **Suckless.** No frameworks, no decorators, no typescript, no build
  magic. Vanilla JS. One file = one concern. If it doesn't fit in one pass,
  split it.
- **Thin core.** Rust does 5 IPC commands + 2 events. That's it. All features
  (tabs, themes, palette, AI) are JS plugins.
- **Small > clever.** A 50-line switch is better than a generic dispatcher.
  Copy-paste is better than a fragile abstraction. Remove code every chance
  you get.
- **Plugins are first-class.** Users override any built-in plugin by dropping
  a file in `~/.config/rift/plugins/<name>/`. Don't bake hardcoded behavior
  into `main.js` or the Rust backend.

## Layout

```
src/main.js                  # Entry — boots core, activates plugins
src/style.css                # Core layout. CSS vars for theming.
src/core/
  event-bus.js               # Pub/sub. on/off/emit/once.
  commands.js                # Registry. register/execute/list.
  settings.js                # Wraps IPC get_settings / update_settings.
  terminal.js                # xterm.js + PTY lifecycle.
  ui-api.js                  # Buttons, side panels, theme registry.
  plugin-loader.js           # Scans dirs, imports, activates.
  rift-api.js                # Assembles RiftAPI object for plugins.
src/plugins/                 # Built-in plugins (replaceable by user).
  shell-selector/            # Shell picker grid on startup.
  toolbar/                   # Shell name, close, settings gear.
  settings/                  # Font/size/theme controls.
  command-palette/           # Ctrl+P fuzzy command search.
  status-bar/                # Bottom bar info.
  default-theme/             # Dark color scheme.
src-tauri/src/
  pty.rs                     # PTY spawn/resize/kill.
  shells.rs                  # Shell discovery.
  commands.rs                # IPC command handlers.
  config.rs                  # Settings persistence.
```

## Rules for agents

1. **Don't add deps.** No new npm/pip/cargo packages unless it's the last
   resort. The current deps are: `@tauri-apps/api`, `@xterm/xterm`,
   `@xterm/addon-fit`, `vite`, `tauri`, `serde`, `portable-pty`. Fight to
   keep it that way.

2. **Write comments when the *why* isn't obvious.** Never comment the *what*
   or *how* — the code says that. Comments justify wtf decisions.

3. **Don't touch Rust unless you must.** If it can be a plugin, it goes in
   `src/plugins/`. The Rust backend is frozen at 5 commands + 2 events.

4. **No bloated error handling.** If a plugin crashes, catch + log + move on.
   No sentry, no crash reporters, no error stacks in user's face.

5. **CSS custom properties for theming.** Never hardcode colors. Everything a
   theme might override goes into `style.css` as `--rift-*` vars.

6. **Keep main.js short.** It boots core (6 imports), loads plugins
   (automatic via plugin-loader), emits phase events. Under 60 lines.

7. **Plugin API is fixed.** Every plugin gets `activate(rift)` where `rift`
   exposes: `events`, `commands`, `terminal`, `ui`, `settings`, `api`. Don't
   add more namespaces without good reason (and good reason means "3+ plugins
   need it").

8. **Test by running the app.** `npm run tauri dev`. No test framework. No CI.
   The app is small enough to verify manually.

## If you're adding a feature

Ask: *Can a plugin do this?*

- Yes → write it as a plugin in `src/plugins/<name>/main.js` + `manifest.json`
- No → it goes in core (core footprint grows by exactly 1 file or less)

Fine print: "plugin" means a directory with `main.js` and
`manifest.json`. That's it. No npm packages, no sub-dependencies, no build
step.