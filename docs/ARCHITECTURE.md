# Rift Architecture

Rift is a **minimal, extensible terminal runtime** — think Neovim, but for
terminal emulation.  The core provides only PTY management, terminal rendering,
and a plugin API.  Everything else (tabs, themes, command palette, AI
assistant) ships as plugins — or is written by users.

## Design principles

1. **Thin core** — The kernel does four things: run PTY subprocesses, render
   terminal output via xterm.js, discover shells, and load plugins.  No tabs,
   no panes, no status bar, no AI features.  Those are all plugins.

2. **Neovim-like extensibility** — Plugins are JavaScript modules that receive
   a `RiftAPI` object.  They can subscribe to events, register commands,
   add UI elements, modify terminal behavior, and change themes — all without
   touching the Rust backend or recompiling.

3. **Everything is a plugin** — Even the built-in shell-selector screen,
   toolbar, and settings panel are plugins.  They ship with the app but can be
   replaced or disabled by user-written plugins of the same name.

4. **Zero config to start** — Rift works out of the box with sensible
   defaults.  Users find plugins through the command palette or by dropping
   them in `~/.config/rift/plugins/`.

## Layer diagram

```
┌──────────────────────────────────────────────────────────┐
│  PLUGIN LAYER (user + built-in)                          │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ tabs    │ │ ai-chat  │ │ themes   │ │ my-plugin  │  │
│  │ .js     │ │ .js      │ │ .js      │ │ .js        │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘  │
│       │           │            │              │         │
├───────┴───────────┴────────────┴──────────────┴─────────┤
│  API LAYER  (rift.*)                                     │
│  rift.events    rift.commands    rift.terminal            │
│  rift.ui        rift.settings    rift.api (IPC)           │
├──────────────────────────────────────────────────────────┤
│  CORE LAYER (frontend / src/core/)                       │
│  plugin-loader   event-bus    commands   terminal.js     │
│  settings        ui-api       rift-api                   │
├──────────────────────┬───────────────────────────────────┤
│  JS BOOT (main.js)   │  RUST BACKEND (src-tauri/)        │
│  • app entry point   │  • pty.rs    — PTY lifecycle      │
│  • loads core        │  • shells.rs — shell detection    │
│  • activates plugins │  • commands.rs — IPC handlers     │
│  • kicks off render  │  • config.rs — settings persist   │
└──────────────────────┴───────────────────────────────────┘
```

## IPC boundary (unchanged from v0)

The Rust backend stays minimal.  No plugin logic lives here.  The IPC surface
remains exactly the 5 commands and 2 events from v0:

| Command | Purpose |
|---------|---------|
| `list_shells` | Discover available shells |
| `launch_shell` | Spawn a PTY session |
| `write_pty` | Send keyboard input |
| `resize_pty` | Resize terminal dimensions |
| `kill_pty` | Terminate a shell session |

| Event | Fires when |
|-------|------------|
| `pty-output-{id}` | PTY produces stdout |
| `pty-exit-{id}` | PTY process exits |

## Plugin API

Every plugin receives the full `RiftAPI` object when activated.  The API is
structured as several namespaces:

### `rift.events` — Pub/sub event bus

```js
rift.events.on('pty:data', ({ ptyId, data }) => { ... })
rift.events.on('pty:open', ({ ptyId, shell }) => { ... })
rift.events.on('pty:exit', ({ ptyId }) => { ... })
rift.events.on('app:phase', (phase) => { ... }) // 'select' | 'terminal' | 'settings'

// Custom events
rift.events.emit('my-event', payload)

// Unsubscribe
const unsub = rift.events.on('pty:data', handler)
// later: unsub()
```

### `rift.commands` — Command registry + palette

```js
rift.commands.register('my-plugin:hello', {
  label: 'Say Hello',
  category: 'My Plugin',
  icon: '\u{1F44B}',
  handler: () => rift.terminal.write('hello!\n')
})

// Execute programmatically
rift.commands.execute('builtin:open-settings')

// List all for the palette
const all = rift.commands.list()
```

### `rift.terminal` — Terminal control

```js
rift.terminal.write('echo hello\n')
rift.terminal.getInfo()            // { ptyId, shell, cols, rows }
rift.terminal.resize(cols, rows)
rift.terminal.onInput((data) => { ... })   // keyboard input
const id = await rift.terminal.open(shellPath, shellArgs)
rift.terminal.close()
rift.terminal.focus()
```

### `rift.ui` — UI extensions

```js
rift.ui.addButton({
  id: 'my-plugin-btn',
  position: 'toolbar',       // 'toolbar' | 'status-left' | 'status-right'
  label: '\u{1F50D}',
  title: 'Search',
  onClick: () => { ... }
})
rift.ui.removeButton('my-plugin-btn')

rift.ui.addPanel({
  id: 'my-plugin-panel',
  title: 'My Panel',
  side: 'right',
  element: myDomElement,
  minWidth: 250,
})
rift.ui.removePanel('my-plugin-panel')
rift.ui.togglePanel('my-plugin-panel')

rift.ui.registerTheme({
  name: 'my-dark-theme',
  colors: { background: '#000', ... }
})
rift.ui.applyTheme('my-dark-theme')
```

### `rift.settings` — Persistent settings

```js
const fontSize = rift.settings.get('font_size')
rift.settings.set('font_size', 16)

// Namespaced settings for plugins
rift.settings.get('my-plugin:api_key')
rift.settings.set('my-plugin:api_key', 'sk-...')

rift.settings.onChange((key, value) => { ... })
```

### `rift.api` — Raw IPC escape hatch

```js
const shells = await rift.api.invoke('list_shells')
const unsub = await rift.api.listen('pty-output-*', (ev) => { ... })
```

## Built-in plugins

Rift ships with these plugins in `src/plugins/`.  A user can replace any of
them by dropping a plugin with the same name in `~/.config/rift/plugins/`.

| Plugin | Function |
|--------|----------|
| `@rift/shell-selector` | Shell selection grid (initial screen) |
| `@rift/settings` | Font/size/theme settings panel |
| `@rift/toolbar` | Tab bar with shell name + buttons |
| `@rift/command-palette` | Ctrl+P command palette |
| `@rift/status-bar` | Bottom status bar |
| `@rift/default-theme` | Default dark color scheme |

## Boot sequence

```
1. main.js calls boot()
    ├─ Load persisted settings from Rust
    ├─ Emit 'app:ready'
    ├─ Register built-in commands
    ├─ Load built-in plugins (Vite glob)
    │    └─ Each plugin receives a RiftAPI and calls activate(rift)
    ├─ Load user plugins from ~/.config/rift/plugins/
    │    └─ plugins receive RiftAPI, call activate(rift)
    ├─ Wire up shell:selected -> terminal.open()
    └─ Emit 'app:phase' (auto-launch if default_shell set, else 'select')
```

## File map

```
src/
├── main.js                  # App entry point
├── style.css                # Core layout + CSS custom properties
├── core/
│   ├── event-bus.js         # Pub/sub with wildcard support
│   ├── commands.js          # Command registry
│   ├── settings.js          # Persistent settings (wraps Rust IPC)
│   ├── terminal.js          # xterm.js + PTY lifecycle
│   ├── ui-api.js            # Buttons, panels, themes
│   ├── plugin-loader.js     # Discovers + activates plugins
│   └── rift-api.js          # Assembles full RiftAPI object
└── plugins/
    ├── shell-selector/      # src/plugins/shell-selector/
    ├── settings/            # src/plugins/settings/
    ├── toolbar/             # src/plugins/toolbar/
    ├── command-palette/     # src/plugins/command-palette/
    ├── status-bar/          # src/plugins/status-bar/
    └── default-theme/       # src/plugins/default-theme/
```