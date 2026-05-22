# Implementation Plan

## Phase 1 — Core API foundation

Build the four infrastructure modules that everything else depends on.

| Step | File | Deliverable |
|------|------|-------------|
| 1.1 | `src/core/event-bus.js` | Pub/sub with `on()`, `off()`, `emit()`, `once()` |
| 1.2 | `src/core/commands.js` | `register()`, `execute()`, `list()` with metadata |
| 1.3 | `src/core/settings.js` | Read/write via `get_settings`/`update_settings` IPC, change events |
| 1.4 | `src/core/terminal.js` | xterm.js wrapper: open, close, write, resize, onData, events |
| 1.5 | `src/core/ui-api.js` | Button panel, side panel, theme registry, CSS injection |
| 1.6 | `src/core/plugin-loader.js` | Scan dirs, parse manifests, import modules, activate |
| 1.7 | `src/core/aether-api.js` | Assemble all namespaces into single API object |

**Checkpoint:** Core modules exist, can be imported, pass unit logic.

## Phase 2 — Plugin extraction

Extract every hardcoded feature in `main.js` into a built-in plugin.  The app
should work identically — but now every piece is a plugin using the API.

| Step | File | What moves |
|------|------|------------|
| 2.1 | `src/plugins/shell-selector/` | Shell grid: `invoke('list_shells')`, card click → `terminal.open()` |
| 2.2 | `src/plugins/toolbar/` | Tab bar: shell name label, close button, settings gear |
| 2.3 | `src/plugins/settings/` | Font/size picker, inline settings panel |
| 2.4 | `src/plugins/command-palette/` | Ctrl+P overlay, fuzzy filter over `commands.list()` |
| 2.5 | `src/plugins/status-bar/` | Bottom bar: shell name, PTY info |
| 2.6 | `src/plugins/default-theme/` | Apply xterm theme config |

**Checkpoint:** `main.js` is ~50 lines.  App works.  All features are plugins.

## Phase 3 — Plugin loader + external discovery

| Step | Deliverable |
|------|-------------|
| 3.1 | Plugins load from `~/.config/aether/plugins/<name>/` |
| 3.2 | User plugins override built-in plugins of the same name |
| 3.3 | Hot-reload support for dev (watch dir, re-activate) |
| 3.4 | Error isolation: one plugin's crash doesn't take down others |

## Phase 4 — Documentation

| Step | Deliverable |
|------|-------------|
| 4.1 | Plugin authoring guide in `docs/PLUGINS.md` |
| 4.2 | Complete API reference |
| 4.3 | Example plugins in `examples/` |

## Phase 5 — Richer plugins (optional / future)

| Idea | What it would do |
|------|-----------------|
| Tabs | Multiple PTY sessions in tabs via `terminal.open()` |
| Panes | Split terminal view (h/t vim, tmux) |
| AI assistant | Side panel that reads/writes terminal via `pty:data` + `terminal.write()` |
| Session manager | Save/restore terminal sessions |
| Theme gallery | Download themes from a registry |