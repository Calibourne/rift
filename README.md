# Aether

**Minimal, extensible terminal runtime.**  Like Neovim for your terminal.

Aether is a thin core that provides PTY subprocess management, xterm.js
rendering, and a plugin API.  Everything else — shell selector, settings,
toolbar, tabs, AI assistant, themes — is a plugin.

**Release binary:** 2.7 MB  |  **Plugin language:** JavaScript (ES modules)

## Quick start

```bash
npm install
npm run tauri dev
```

## Build for production

```bash
npm run build:win      # MSI + NSIS (Windows)
npm run build:mac      # DMG (macOS)
npm run build:linux    # deb + AppImage (Linux)
```

## Architecture

```
┌─────────────────────────────────────────────┐
│  PLUGINS  (JS — built-in + user-written)    │
│  shell-selector, settings, toolbar,         │
│  command-palette, status-bar, themes, ...   │
├─────────────────────────────────────────────┤
│  API LAYER  (aether.*)                      │
│  events · commands · terminal · ui ·        │
│  settings · api (raw IPC)                   │
├──────────────────┬──────────────────────────┤
│  FRONTEND CORE   │  RUST BACKEND            │
│  plugin-loader   │  pty.rs   — PTY I/O      │
│  event-bus       │  shells.rs— detection    │
│  commands        │  commands.rs — IPC       │
│  terminal.js     │  config.rs — settings    │
│  ...             │                           │
└──────────────────┴──────────────────────────┘
```

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full design.

## Plugin system

Plugins are JavaScript modules that export `activate(aether)`:

```js
// ~/.config/aether/plugins/my-plugin/main.js
export function activate(aether) {
  aether.commands.register('my-plugin:hello', {
    label: 'Say Hello',
    handler: () => aether.terminal.write('hello from a plugin!\n')
  });
}
```

Drop a plugin in `~/.config/aether/plugins/<name>/` and it's loaded on next
launch.  No recompilation, no config files to edit.

## Rust backend

The backend stays minimal by design — 5 IPC commands, 2 events, no plugin
logic.  All extensibility lives in the frontend.

| Command       | Does                        |
|---------------|-----------------------------|
| `list_shells` | Discover available shells   |
| `launch_shell`| Spawn a PTY session         |
| `write_pty`   | Send keyboard input         |
| `resize_pty`  | Resize terminal dimensions  |
| `kill_pty`    | Terminate a shell session   |

| Event              | Fires when            |
|--------------------|-----------------------|
| `pty-output-{id}`  | PTY produces stdout   |
| `pty-exit-{id}`    | PTY process exits     |

## Project structure

```
aether/
├── src/                        # Frontend (vanilla JS + xterm.js)
│   ├── main.js                 # Thin entry point
│   ├── style.css               # Core layout styles
│   ├── core/                   # Plugin API infrastructure
│   │   ├── event-bus.js
│   │   ├── commands.js
│   │   ├── settings.js
│   │   ├── terminal.js
│   │   ├── ui-api.js
│   │   ├── plugin-loader.js
│   │   └── aether-api.js
│   └── plugins/                # Built-in plugins (bundled)
│       ├── shell-selector/
│       ├── settings/
│       ├── toolbar/
│       ├── command-palette/
│       ├── status-bar/
│       └── default-theme/
├── src-tauri/                  # Rust backend (Tauri)
│   ├── src/
│   │   ├── pty.rs
│   │   ├── shells.rs
│   │   ├── commands.rs
│   │   └── config.rs
│   └── Cargo.toml
├── docs/
│   ├── ARCHITECTURE.md         # Full architecture
│   ├── PLAN.md                 # Implementation roadmap
│   └── PLUGINS.md              # Plugin authoring guide (WIP)
├── package.json
└── vite.config.ts
```

## License

MIT