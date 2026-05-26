<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/icon.svg">
  <img alt="Rift — a minimal, extensible terminal runtime" src="public/icon.svg" width="128" height="128">
</picture>

# Rift

**A minimal, extensible terminal runtime.**

Think Neovim, but for your terminal emulator. A 2.7 MB binary with a
JavaScript plugin API. No bloat, no frameworks, no config required.

<p>
  <a href="#quick-start"><code>🚀  Quick start</code></a>
  <a href="#architecture"><code>🏗️  Architecture</code></a>
  <a href="#plugin-system"><code>🔌  Plugin system</code></a>
  <a href="#building"><code>📦  Building</code></a>
</p>

---

## Quick start

```bash
npm install
npm run tauri dev
```

That's it. Rift scans your installed shells, opens a picker, and drops you
into a running terminal. Everything else — tabs, themes, AI assistant,
settings — is a plugin you add when you need it.

## Philosophy

Rift is built on a single bet: **the best terminal is one you can shape.**

The core does exactly five things, and it does them in Rust. One PTY per
tab. One renderer (xterm.js). One API for plugins. That's the contract.

Everything above that line — the shell selector, the toolbar, the command
palette, the settings panel, even the default color scheme — lives in
JavaScript plugins. Built-in ones ship with the app. User-written ones live
in `~/.config/rift/plugins/`. Same API. No recompilation. No config files
to hunt down.

You don't like the default theme? Drop in a replacement. The toolbar doesn't
suit your workflow? Override it. Every built-in plugin can be replaced by a
user plugin of the same name. The core never needs to know.

## Architecture

```
┌─────────────────────────────────────────────┐
│  PLUGINS  (JS — built-in + user-written)    │
│  shell-selector, settings, toolbar,         │
│  command-palette, status-bar, themes, ...   │
├─────────────────────────────────────────────┤
│  API LAYER  (rift.*)                        │
│  events · commands · terminal · ui ·        │
│  settings · api (raw IPC)                   │
├──────────────────┬──────────────────────────┤
│  FRONTEND CORE   │  RUST BACKEND            │
│  plugin-loader   │  pty.rs    — PTY I/O     │
│  event-bus       │  shells.rs — detection   │
│  commands        │  commands.rs — IPC       │
│  terminal.js     │  config.rs — settings    │
│  ...             │                           │
└──────────────────┴──────────────────────────┘
```

The Rust backend is frozen at **5 IPC commands** and **2 events** — no plugin
logic, no extensibility. All of that lives in the JS layer.

| Command          | Purpose                        |
|------------------|---------------------------------|
| `list_shells`    | Discover available shells       |
| `launch_shell`   | Spawn a PTY session             |
| `write_pty`      | Send keyboard input             |
| `resize_pty`     | Resize terminal dimensions      |
| `kill_pty`       | Terminate a shell session       |

| Event                  | Fires when                 |
|------------------------|----------------------------|
| `pty-output-{id}`      | PTY produces stdout        |
| `pty-exit-{id}`        | PTY process exits          |

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full design dive.

## Plugin system

Plugins are plain JavaScript modules that export a single function:

```js
// ~/.config/rift/plugins/my-plugin/main.js
export function activate(rift) {
  rift.commands.register('my-plugin:hello', {
    label: 'Say Hello',
    handler: () => rift.terminal.write('hello from a plugin!\n')
  })
}
```

Drop a folder in `~/.config/rift/plugins/<name>/` with `main.js` and
`manifest.json`, and it's loaded on next launch. No recompilation, no
package manager, no config file to edit.

### What plugins can do

| Namespace       | Capabilities                                    |
|-----------------|-------------------------------------------------|
| `rift.events`   | Subscribe to PTY I/O, lifecycle, app phases     |
| `rift.commands` | Register commands, wire into Ctrl+P palette     |
| `rift.terminal` | Write to PTY, resize, open/close sessions       |
| `rift.ui`       | Add buttons, side panels, register themes       |
| `rift.settings` | Persistent key-value store (per-plugin scoped)  |
| `rift.api`      | Raw IPC invoke/listen for custom Rust commands   |

### Replaceable built-ins

These ship with Rift but can be fully overridden by user plugins:

| Plugin              | What it does                     |
|---------------------|----------------------------------|
| `shell-selector`    | Shell picker grid on startup     |
| `toolbar`           | Tab bar, shell name, buttons     |
| `settings`          | Font/size/theme control panel    |
| `command-palette`   | Ctrl+P fuzzy command search      |
| `status-bar`        | Bottom bar with session info     |
| `default-theme`     | Default dark color scheme        |

## Project structure

```
rift/
├── src/                        # Frontend (vanilla JS + xterm.js)
│   ├── main.js                 # Entry — under 60 lines
│   ├── style.css               # Core layout, CSS custom properties
│   ├── core/                   # Plugin API infrastructure
│   │   ├── event-bus.js        # Pub/sub, wildcard support
│   │   ├── commands.js         # Command registry
│   │   ├── settings.js         # Persistent settings (IPC-backed)
│   │   ├── terminal.js         # xterm.js + PTY lifecycle
│   │   ├── ui-api.js           # Buttons, panels, theme registry
│   │   ├── plugin-loader.js    # Scans and activates plugins
│   │   └── rift-api.js         # Assembles the RiftAPI object
│   └── plugins/                # Built-in plugins (bundled)
│       ├── shell-selector/
│       ├── settings/
│       ├── toolbar/
│       ├── command-palette/
│       ├── status-bar/
│       └── default-theme/
├── src-tauri/                  # Rust backend (Tauri)
│   ├── src/
│   │   ├── pty.rs              # PTY subprocess I/O
│   │   ├── shells.rs           # Shell autodetection
│   │   ├── commands.rs         # IPC command handlers
│   │   └── config.rs           # Settings persistence
│   └── Cargo.toml
├── docs/
│   ├── ARCHITECTURE.md         # Full design document
│   ├── PLAN.md                 # Implementation roadmap
│   └── PLUGINS.md              # Plugin authoring guide
├── public/
│   └── icon.svg                # App icon
├── package.json
└── vite.config.ts
```

## Building

```bash
npm run build:win      # MSI + NSIS installer  (Windows)
npm run build:mac      # DMG                   (macOS)
npm run build:linux    # deb + AppImage        (Linux)
```

## License

MIT