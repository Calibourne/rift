# Settings Modal Design

**Date:** 2026-05-22
**Status:** Approved

## Problem

Settings UX is split across an inline panel (font + size) and a full-page
settings view. Neither feels polished. Goal: telescope-style modal overlay
that works for normies while keeping the suckless ethos.

## Prior Art

- **Neovim Telescope** — floating centered window, searchable, preview inline,
  doesn't displace the underlying editor
- **VS Code Settings** — JSON file editing + searchable UI, instant apply
- **Kakoune / Helix** — no settings UI, all config in files

Aether splits the difference: telescope-style modal for normies, JSON files
for power users.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User input (modal / direct file edit)                      │
│                                                             │
│  Ctrl+, ─→ settings.js ─→ invoke('update_settings') ─→ Rust│
│  vim edits               ↕                                  │
│  settings.json ←─ std::fs ── get_settings ←─ invoke ────── │
└─────────────────────────────────────────────────────────────┘
```

- **Rust** (`config.rs`): reads/writes `~/.config/aether/settings.json`
  as flat JSON. No schema validation — just serde_json read/write.
- **JS** (`settings.js`): in-memory store, `get`/`set`/`onChange` API.
  `set()` calls `invoke('update_settings')`, `load()` calls `invoke('get_settings')`.
- **Modal**: reads store on open, calls `set()` on each change → immediate
  persist + terminal reactivity.

No file watcher. Power users edit JSON in vim, restart. Normies use the modal.

## Settings Modal (Ctrl+,)

### Layout

```
┌──────────────────────────────────────────┐
│  terminal running beneath (dimmed)       │
│                                          │
│    ┌──────────────────────────────┐      │
│    │ ⚙ aether settings           │      │
│    │                              │      │
│    │ Font Family                  │      │
│    │ [JetBrains Mono          ▼] │      │
│    │                              │      │
│    │ Font Size                    │      │
│    │ [=====●==============] 16px │      │
│    │                              │      │
│    │ Theme                        │      │
│    │ [aether-dark             ▼] │      │
│    │ [Edit Colors ▸]             │      │
│    │                              │      │
│    │ [Esc] close · [Tab] nav     │      │
│    └──────────────────────────────┘      │
│                                          │
└──────────────────────────────────────────┘
```

### Behavior

- **Trigger**: `Ctrl+,` anywhere (capture phase, like Ctrl+P)
- **Esc**: close, focus returns to terminal
- **Tab / Shift+Tab**: cycle through controls
- **Changes**: instant apply on select/input change (calls `settings.set()`)
- **Terminal**: slightly dimmed backdrop (opacity overlay via CSS)
- **Width**: compact, ~400px. Fits font select + size slider without overflow.

### Controls

| Control | Type | Source |
|---------|------|--------|
| Font Family | `<select>` 14 options (same list as current) | `settings.get('font_family')` |
| Font Size | `<input type="range">` 10–24, step 1 | `settings.get('font_size')` |
| Theme | `<select>` themes from `~/.config/aether/themes/*.json` | File scan on modal open |

### Backend

**Rust** `config.rs` — already exists. No changes needed.

Add a `list_themes` command:

```rust
#[tauri::command]
pub fn list_themes(app: AppHandle) -> Vec<String> {
    let mut path = app.path().app_config_dir().unwrap_or_default();
    path.push("themes");
    let mut themes = vec!["aether-dark".into()];
    if let Ok(entries) = std::fs::read_dir(&path) {
        for entry in entries.flatten() {
            if entry.path().extension().map_or(false, |e| e == "json") {
                if let Some(name) = entry.path().file_stem().and_then(|s| s.to_str()) {
                    themes.push(name.to_string());
                }
            }
        }
    }
    themes
}
```

### File Format

`~/.config/aether/settings.json`:
```json
{
  "font_family": "'JetBrainsMono Nerd Font',...",
  "font_size": 14,
  "default_shell": "{\"name\":\"PowerShell\",\"path\":\"...\",\"args\":[]}",
  "theme": "aether-dark"
}
```

`~/.config/aether/themes/aether-dark.json`:
```json
{
  "name": "aether-dark",
  "background": "#0e0e1a",
  "foreground": "#d0d0d0",
  "cursor": "#e0e0e0",
  "selectionBackground": "#334",
  "black": "#1a1a2e",
  "red": "#e57373",
  "green": "#81c784",
  "yellow": "#ffd54f",
  "blue": "#64b5f6",
  "magenta": "#ce93d8",
  "cyan": "#4dd0e1",
  "white": "#d0d0d0",
  "brightBlack": "#444",
  "brightRed": "#ef9a9a",
  "brightGreen": "#a5d6a7",
  "brightYellow": "#fff176",
  "brightBlue": "#90caf9",
  "brightMagenta": "#e1bee7",
  "brightCyan": "#80deea",
  "brightWhite": "#f5f5f5"
}
```

## Theme Editor (Expandable)

### Collapsed

Selected theme shown as `<select>`. "Edit Colors" link expands the editor.

### Expanded

```
    ┌──────────────────────────────┐
    │ ▾ Edit Colors                │
    │                              │
    │ ██ bg [#0e0e1a] ██ fg [#d0] │
    │ ██ cur [#e0e0e0]██ sel[#334]│
    │ ██ black [#1a1a2e]          │
    │ ██ red [#e57373]  ██ ...    │
    │ ... (all 18 colors, 2/row)  │
    │                              │
    │ [Reset to preset]            │
    └──────────────────────────────┘
```

### Hex Preview

Each row: `<span class="swatch" style="background: currentHex">` before the
`<input type="text" maxlength="7" value="#rrggbb">`. Input change → swatch
updates immediately (`oninput`). No debounce — hex validation is instant.

### Save

"Edit Colors" creates/modifies `~/.config/aether/themes/custom.json`.
Selecting a different preset discards unsaved edits (confirm dialog optional —
suckless says no confirm, just overwrite).

When theme is changed:

```js
// settings.js
async function set(key, value) {
  store[key] = value
  events.emit('settings:changed', { key, value })
  // Persist
  await invoke('update_settings', { settings: { ...store } })
}
```

`terminal.js` already listens for `settings:changed` and updates
`term.options.fontSize` / `fontFamily`. Theme changes need:

```js
events.on('settings:changed', ({ key, value }) => {
  if (key === 'theme') {
    // Load theme JSON and apply to xterm
    const theme = await loadTheme(value)
    term.options.theme = theme
  }
})
```

## Removed

- **Inline panel** (font + size between toolbar and terminal) — replaced by modal
- **Full settings page** (gear icon → full screen settings) — replaced by modal
- **File watcher** — power users edit JSON in vim, restart. Not worth complexity.

## Future: Plugin Hot-Reload

The plugin loader (`plugin-loader.js`) can already activate and deactivate
plugins at runtime. What's missing is a trigger.

Sketch for a future "Plugin Manager" command:

1. User drops a plugin folder in `~/.config/aether/plugins/<name>/`
2. `Ctrl+P` → "Reload Plugins"
3. Plugin loader:
   - Deactivates all current plugins
   - Clears event bus listeners (or scopes them)
   - Re-scans built-in + user plugin directories
   - Re-activates all plugins
   - Emits `app:phase` to restore current state

This enables the plugin registry (bucket list item 2) without restarting
the app. The core infrastructure exists — just needs the "reload" command
and user plugin file scanning (Phase 3 from PLAN.md).

## Implementation Order

1. **Modal shell** — telescope-style overlay component, `Ctrl+,` binding,
   backdrop dimming. No controls yet.
2. **Settings form** — font select + size slider inside modal, instant apply
3. **Theme select** — list presets from `~/.config/aether/themes/`, scan on
   modal open
4. **Theme editor** — expandable hex grid, live swatch, save as custom.json
5. **Cleanup** — remove inline panel, full settings page, dead CSS