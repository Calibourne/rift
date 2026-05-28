<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/icon.svg">
  <img alt="Rift — a minimal, extensible terminal runtime" src="public/icon.svg" width="128" height="128">
</picture>

# Rift

**A minimal, extensible terminal runtime.**

Think Neovim, but for your terminal emulator. A 2.7 MB binary with a
JavaScript plugin API. No bloat, no build steps, no configuration required
to get started.

<p>
  <a href="#try-it"><code>🚀  Try it</code></a>
  <a href="#architecture"><code>🏗️  Architecture</code></a>
  <a href="#plugin-system"><code>🔌  Plugin system</code></a>
  <a href="#how-it-compares"><code>⚖️  How it compares</code></a>
</p>

---

## Try it

### Download a release

Grab the latest binary from the [Releases page](https://github.com/Calibourne/rift/releases):

| Platform | Format |
|----------|--------|
| Linux    | `.deb` or `.AppImage` |
| Windows  | `.msi` or `.exe` (NSIS installer) |

### Build from source

```bash
npm install
npm run tauri dev
```

Rift scans your installed shells, opens a picker, and drops you
into a running terminal. Everything beyond that — theme, keybindings,
command palette — you add as plugins when you need them.

## Philosophy

Rift is built on a single bet: **the best terminal is one you can shape.**

The core does exactly five things, and it does them in Rust. One PTY per
tab. One renderer (xterm.js). One API for plugins. That's the contract.

Everything above that line — the shell selector, the toolbar, the command
palette, the settings panel, even the color scheme — lives in
JavaScript plugins. Built-in ones ship with the app. User-written ones live
in `~/.config/rift/plugins/`. Same API. No recompilation. No config files
to hunt down.

Don't like the default theme? Drop in a replacement. The toolbar doesn't
suit your workflow? Override it. Every built-in plugin can be replaced by a
user plugin of the same name. The core never needs to know.

## Architecture

```
┌─────────────────────────────────────────────┐
│  PLUGINS  (JS — built-in + user-written)    │
│  shell-selector, settings, toolbar,         │
│  command-palette, status-bar, 3 themes...   │
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

The Rust backend is frozen at **5 IPC commands** and **2 events** — that's
the full surface area. No plugin logic, no extensibility. All of that lives
in the JS layer.

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
`manifest.json`, and it's loaded on next launch. No package manager, no
recompilation, no config file to edit.

### What plugins can do

| Namespace       | Capabilities                                    |
|-----------------|-------------------------------------------------|
| `rift.events`   | Subscribe to PTY I/O, lifecycle, app phases     |
| `rift.commands` | Register commands, wire into Ctrl+P palette     |
| `rift.terminal` | Write to PTY, resize, open/close sessions       |
| `rift.ui`       | Add buttons, side panels, register themes       |
| `rift.settings` | Persistent key-value store (per-plugin scoped)  |
| `rift.api`      | Raw IPC invoke/listen for custom Rust commands   |

### Built-in plugins

These ship with Rift. Drop a user plugin with the same name to replace one.

| Plugin              | What it does                     |
|---------------------|----------------------------------|
| `shell-selector`    | Shell picker grid on startup     |
| `toolbar`           | Tab bar, shell name, buttons     |
| `settings`          | Font/size/theme control panel    |
| `command-palette`   | Ctrl+P fuzzy command search      |
| `status-bar`        | Bottom bar with session info     |
| `default-theme`     | Default dark color scheme        |
| `catppuccin-theme`  | Catppuccin Mocha color palette   |
| `doom-one-theme`    | Doom Emacs inspired colors       |

## How it compares

People ask: *why not just use Alacritty + tmux?*

**Alacritty** is the best GPU-accelerated terminal, but its extensibility
ends where its config file ends. Want a custom UI element? A side panel?
Integration with an LLM? You need a multiplexer or a separate tool.

**tmux** gives you tabs, splits, and persistence, but it's a different
paradigm — you're not extending the terminal, you're wrapping it in a
terminal UI. And you're writing shell scripts, not JavaScript.

**Warp** is innovative but opinionated — cloud accounts, AI built in,
a custom rendering engine. It does a lot for you, but you can't change
how it works.

**Kitty** has a powerful config system and remote control, but its
extensibility is Python-in-a-config-file, not a proper plugin API.

**Rift** lands in a different spot: a minimal core with a JavaScript
plugin API that lets you build exactly what you need. No multiplexer
layer. No cloud dependency. No framework you have to buy into. Just
a terminal that you shape.

## Project structure

```
rift/
├── src/              # Frontend (vanilla JS + xterm.js)
│   ├── main.js       # Entry — under 60 lines
│   ├── style.css     # CSS custom properties for theming
│   ├── core/         # Event bus, commands, terminal, settings, UI API
│   └── plugins/      # 8 built-in plugins, one folder each
├── src-tauri/        # Rust backend (pty, shells, IPC, config)
├── docs/             # Architecture, roadmap, plugin guide
├── public/icon.svg   # App icon
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