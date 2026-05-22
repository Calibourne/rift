# Aether Architecture

Aether is a **minimal, extensible terminal runtime** — think Neovim, but for
terminal emulation.  The core provides only PTY management, terminal rendering,
and a plugin API.  Everything else (tabs, themes, command palette, AI
assistant) ships as plugins — or is written by users.

## Design principles

1. **Thin core** — The kernel does four things: run PTY subprocesses, render
   terminal output via xterm.js, discover shells, and load plugins.  No tabs,
   no panes, no status bar, no AI features.  Those are all plugins.

2. **Neovim-like extensibility** — Plugins are JavaScript modules that receive
   an `AetherAPI` object.  They can subscribe to events, register commands,
   add UI elements, modify terminal behavior, and change themes — all without
   touching the Rust backend or recompiling.

3. **Everything is a plugin** — Even the built-in shell-selector screen,
   toolbar, and settings panel are plugins.  They ship with the app but can be
   replaced or disabled by user-written plugins of the same name.

4. **Zero config to start** — Aether works out of the box with sensible
   defaults.  Users find plugins through the command palette or by dropping
   them in `~/.config/aether/plugins/`.

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
│  API LAYER  (aether.*)                                   │
│  aether.events  aether.commands  aether.terminal         │
│  aether.ui      aether.settings  aether.api (IPC)        │
├──────────────────────────────────────────────────────────┤
│  CORE LAYER (frontend / src/core/)                       │
│  plugin-loader   event-bus    commands   terminal.js     │
│  settings        ui-api       aether-api                 │
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
| `write_pty` | Send input to a shell |
| `resize_pty` | Resize the PTY dimensions |
| `kill_pty` | Terminate a shell session |

| Event | Purpose |
|-------|---------|
| `pty-output-{id}` | PTY stdout → frontend |
| `pty-exit-{id}` | PTY process exited |

## Plugin format

```
~/.config/aether/plugins/<name>/
├── manifest.json         # Required: name, version, main, description
└── main.js               # Required: exports activate(aether) { ... }

// Optional — loaded by main.js via import or fetch
├── style.css              # Injected into the page on activation
├── icon.svg               # Shown in command palette / plugin list
└── ...                    # Any other assets (loaded by plugin itself)
```

### manifest.json

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "description": "What this plugin does",
  "main": "main.js",
  "contributes": {
    "commands": [
      { "id": "my-plugin:hello", "label": "Say Hello" }
    ],
    "themes": [],
    "keybindings": []
  }
}
```

## Plugin API reference

Every plugin receives the full `AetherAPI` object when activated.  The API is
split into namespaces:

### `aether.events` — Pub/sub event bus

```js
// Subscribe
aether.events.on('pty:data', ({ ptyId, data }) => { ... })
aether.events.on('pty:open', ({ ptyId, shell }) => { ... })
aether.events.on('pty:exit', ({ ptyId }) => { ... })
aether.events.on('app:phase', (phase) => { ... }) // 'select' | 'terminal' | 'settings'

// Fire
aether.events.emit('my-event', payload)

// Unsubscribe
const unsub = aether.events.on('pty:data', handler)
unsub() // removes the listener
```

### `aether.commands` — Command registry + palette

```js
// Register
aether.commands.register('my-plugin:hello', {
  label: 'Say Hello',
  category: 'My Plugin',
  icon: '👋',
  handler: () => console.log('Hello from plugin!')
})

// Execute programmatically
aether.commands.execute('builtin:open-settings')

// List all
const all = aether.commands.list()
```

### `aether.terminal` — Terminal control

```js
aether.terminal.write('echo hello\n')

aether.terminal.getInfo()
// => { ptyId, shell: { name, path }, cols, rows }

aether.terminal.resize(cols, rows)

// Subscribe to user keyboard input
aether.terminal.onInput((data) => { ... })

// Open a new terminal (returns ptyId)
const id = await aether.terminal.open(shellPath, shellArgs)

// Close current terminal
aether.terminal.close()

// Focus the terminal
aether.terminal.focus()
```

### `aether.ui` — UI extensions

```js
// Add a button to the toolbar
aether.ui.addButton({
  position: 'toolbar',  // 'toolbar' | 'status-left' | 'status-right'
  id: 'my-plugin-btn',
  label: '🔍',
  title: 'Search',
  onClick: () => { ... }
})

// Remove a button
aether.ui.removeButton('my-plugin-btn')

// Add a side panel
aether.ui.addPanel({
  id: 'my-plugin-panel',
  title: 'My Panel',
  side: 'right',       // 'left' | 'right'
  element: myDomNode,
  minWidth: 200,
})

// Remove panel
aether.ui.removePanel('my-plugin-panel')

// Toggle panel visibility
aether.ui.togglePanel('my-plugin-panel')

// Themes
aether.ui.registerTheme({
  name: 'my-dark-theme',
  colors: {
    background: '#000',
    foreground: '#fff',
    cursor: '#0f0',
    // ... full terminal theme map
  }
})

aether.ui.applyTheme('my-dark-theme')
```

### `aether.settings` — Persistent settings

```js
// Read
const fontSize = aether.settings.get('font_size')

// Write
aether.settings.set('font_size', 16)

// Plugin-scoped settings (stored under plugin namespace)
aether.settings.get('my-plugin:api_key')
aether.settings.set('my-plugin:api_key', 'sk-...')

// React to changes
aether.settings.onChange((key, value) => { ... })
```

### `aether.api` — Raw IPC escape hatch

```js
// Direct Tauri invoke
const shells = await aether.api.invoke('list_shells')

// Direct Tauri event listen
const unsub = await aether.api.listen('pty-output-*', (ev) => { ... })
```

## Built-in plugins (ship with binary)

These live in `src/plugins/` and are bundled by Vite.  They work exactly like
user plugins — they use the same API.  Users can override them by placing a
plugin with the same name in `~/.config/aether/plugins/`.

| Plugin | What it provides |
|--------|-----------------|
| `@aether/shell-selector` | Shell selection grid (initial screen) |
| `@aether/settings` | Font/size/theme settings panel |
| `@aether/toolbar` | Tab bar with shell name + buttons |
| `@aether/command-palette` | Ctrl+P command palette |
| `@aether/status-bar` | Bottom status bar |
| `@aether/default-theme` | Default dark color scheme |

## Event reference

### Core events (always available)

| Event | Payload | When |
|-------|---------|------|
| `app:ready` | `{}` | Core modules initialized, plugins loaded |
| `app:phase` | `'select' \| 'terminal' \| 'settings'` | App phase changes |
| `pty:open` | `{ ptyId, shell }` | New PTY session created |
| `pty:data` | `{ ptyId, data }` | Data from PTY → terminal |
| `pty:resize` | `{ ptyId, cols, rows }` | Terminal resized |
| `pty:exit` | `{ ptyId }` | PTY process exited |
| `command:registered` | `{ id, command }` | New command registered |
| `command:executed` | `{ id }` | Command executed |
| `settings:changed` | `{ key, value }` | Setting modified |
| `theme:applied` | `{ name }` | Theme applied |

## Plugin lifecycle

```
app boot
  └─ core modules initialize (event-bus, commands, settings)
  └─ plugin-loader discovers plugins:
      1. Load built-in plugins from src/plugins/
      2. Load user plugins from ~/.config/aether/plugins/
      3. For each plugin: read manifest.json, import main.js
  └─ plugins receive AetherAPI, call activate(aether)
  └─ app:ready emitted
  └─ initial render (shell-selector)
```

When a plugin is reloaded (hot-reload during dev):
```
app:phase → 'reloading-plugins'
  └─ for each active plugin: deactivate() called (if exported)
  └─ plugin-loader re-scans directories
  └─ new plugins activated
  └─ app:phase → previous phase
```

## File structure

```
src/
├── main.js                       # Entry: boot core, load plugins, render
├── style.css                     # Core styles (minimal, reset + layout)
├── core/
│   ├── event-bus.js              # Pub/sub event system
│   ├── commands.js               # Command registry + palette
│   ├── settings.js               # Settings manager (load/save via IPC)
│   ├── terminal.js               # xterm.js wrapper
│   ├── ui-api.js                 # UI extension host (toolbar, panels, themes)
│   ├── plugin-loader.js          # Discover + activate plugins
│   └── aether-api.js             # Assembles full AetherAPI object
├── plugins/
│   ├── shell-selector/
│   │   ├── manifest.json
│   │   ├── main.js
│   │   └── style.css
│   ├── settings/
│   │   ├── manifest.json
│   │   ├── main.js
│   │   └── style.css
│   ├── toolbar/
│   │   ├── manifest.json
│   │   ├── main.js
│   │   └── style.css
│   ├── command-palette/
│   │   ├── manifest.json
│   │   ├── main.js
│   │   └── style.css
│   ├── status-bar/
│   │   ├── manifest.json
│   │   ├── main.js
│   │   └── style.css
│   └── default-theme/
│       ├── manifest.json
│       └── main.js
src-tauri/                        # Unchanged (Rust backend)
├── ...
```
