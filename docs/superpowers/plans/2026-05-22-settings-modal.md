# Settings Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline panel + full-page settings with a telescope-style modal overlay (`Ctrl+,`) featuring font/size controls, theme picker, and expandable hex color editor.

**Architecture:** New Rust commands for theme file I/O. Rewrite existing settings plugin as a floating modal. Terminal core module reacts to theme changes via existing `settings:changed` event. Remove old inline panel DOM from toolbar.

**Tech Stack:** Tauri v2 (Rust + JS), xterm.js, vanilla JS DOM

---

### Task 1: Rust — add `list_themes` and `read_theme_file` commands

**Files:**
- Modify: `src-tauri/src/config.rs`
- Modify: `src-tauri/src/lib.rs`

Provides theme discovery and file reading so the settings modal can list presets and load colors.

- [ ] **Step 1: Add `list_themes` command**

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

Add after `update_settings` in `config.rs`.

- [ ] **Step 2: Add `read_theme_file` command**

```rust
#[tauri::command]
pub fn read_theme_file(app: AppHandle, name: String) -> Result<String, String> {
    let mut path = app.path().app_config_dir().unwrap_or_default();
    path.push("themes");
    path.push(format!("{}.json", name));
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
```

Add after `list_themes` in `config.rs`.

- [ ] **Step 3: Register new commands in lib.rs**

```rust
.invoke_handler(tauri::generate_handler![
    commands::list_shells,
    commands::launch_shell,
    commands::write_pty,
    commands::resize_pty,
    commands::kill_pty,
    config::get_settings,
    config::update_settings,
    config::list_themes,        // add
    config::read_theme_file,    // add
])
```

Add to the `invoke_handler` list in `src-tauri/src/lib.rs`.

- [ ] **Step 4: Build check**

```bash
cd src-tauri && cargo build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/config.rs src-tauri/src/lib.rs
git commit -m "feat(rust): list_themes + read_theme_file IPC commands"
```

---

### Task 2: Settings modal plugin — rewrite `src/plugins/settings/`

**Files:**
- Create: `src/plugins/settings/main.js` (full rewrite)
- Create: `src/plugins/settings/style.css` (full rewrite)
- Keep: `src/plugins/settings/manifest.json`

Rewrites the settings plugin to render a telescope-style floating modal instead of the inline panel + full page.

- [ ] **Step 1: Write settings modal styles**

`src/plugins/settings/style.css`:

```css
/* Settings modal overlay */
.settings-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.settings-modal {
  background: var(--aether-chromeBg, #14142a);
  border: 1px solid var(--aether-chromeBorder, #3a3a4e);
  border-radius: 10px;
  width: 420px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

.settings-modal-header {
  padding: 14px 18px 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--aether-textBright, #f0f0f0);
}

.settings-modal-body {
  padding: 14px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-modal-footer {
  padding: 0 18px 12px;
  font-size: 0.6875rem;
  color: var(--aether-textMuted, #555);
  text-align: right;
}

/* Control rows */
.sm-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sm-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--aether-textMuted, #888);
}

/* Inherit ts-select / ts-size-control from existing settings.css */
/* Add theme select */
.sm-theme-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sm-edit-colors {
  background: none;
  border: none;
  color: var(--aether-accent, #64b5f6);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0;
}
.sm-edit-colors:hover { text-decoration: underline; }

/* Expanded color editor */
.sm-color-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 8px;
}

.sm-color-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sm-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid var(--aether-chromeBorder, #3a3a4e);
  flex-shrink: 0;
}

.sm-hex-input {
  width: 72px;
  background: var(--aether-cardBg, #1e1e34);
  border: 1px solid var(--aether-chromeBorder, #3a3a4e);
  border-radius: 4px;
  color: var(--aether-textBright, #ccc);
  font-size: 0.6875rem;
  font-family: monospace;
  padding: 2px 4px;
  outline: none;
}
.sm-hex-input:focus { border-color: var(--aether-accent, #64b5f6); }

.sm-color-label {
  font-size: 0.625rem;
  color: var(--aether-textMuted, #666);
  width: 28px;
  text-align: right;
}

/* Reset button */
.sm-reset-btn {
  background: none;
  border: 1px solid var(--aether-chromeBorder, #3a3a4e);
  border-radius: 5px;
  color: var(--aether-textMuted, #888);
  cursor: pointer;
  font-size: 0.6875rem;
  padding: 4px 10px;
  margin-top: 6px;
}
.sm-reset-btn:hover {
  border-color: #5a5a7e;
  color: var(--aether-textBright, #ccc);
}
```

- [ ] **Step 2: Write settings modal main.js**

`src/plugins/settings/main.js`:

```js
/**
 * @aether/settings
 *
 * Telescope-style floating modal for font, size, and theme.
 * Ctrl+, to toggle. Esc to close. Tab to navigate.
 */

import './style.css'

const FONTS = [
  { l: 'JetBrains Mono',          v: "'JetBrainsMono Nerd Font','JetBrains Mono','Fira Code',monospace" },
  { l: 'Fira Code',               v: "'FiraCode Nerd Font','Fira Code','JetBrains Mono',monospace" },
  { l: 'Cascadia Code',           v: "'Cascadia Code','Cascadia Mono','CaskaydiaCove Nerd Font',monospace" },
  { l: 'Meslo',                   v: "'MesloLGS Nerd Font','Meslo LG S','Menlo',monospace" },
  { l: 'Hack',                    v: "'Hack Nerd Font',Hack,'Courier New',monospace" },
  { l: 'Victor Mono',            v: "'VictorMono Nerd Font','Victor Mono','JetBrains Mono',monospace" },
  { l: 'Iosevka',                v: "'Iosevka Nerd Font',Iosevka,monospace" },
  { l: 'Source Code Pro',        v: "'SauceCodePro Nerd Font','Source Code Pro',monospace" },
  { l: 'Ubuntu Mono',            v: "'UbuntuMono Nerd Font','Ubuntu Mono',monospace" },
  { l: 'DejaVu Sans Mono',      v: "'DejaVuSansMono Nerd Font','DejaVu Sans Mono',monospace" },
  { l: 'Menlo',                  v: "Menlo,Monaco,'Courier New',monospace" },
  { l: 'Consolas',               v: "Consolas,'Courier New',monospace" },
  { l: 'Inconsolata',            v: "Inconsolata,'DejaVu Sans Mono',monospace" },
  { l: 'Courier New',            v: "'Courier New',monospace" },
]

const COLOR_KEYS = [
  ['bg', 'background'], ['fg', 'foreground'],
  ['cur', 'cursor'], ['sel', 'selectionBackground'],
  ['blk', 'black'], ['red', 'red'],
  ['grn', 'green'], ['yel', 'yellow'],
  ['blu', 'blue'], ['mag', 'magenta'],
  ['cya', 'cyan'], ['wht', 'white'],
  ['bBlk', 'brightBlack'], ['bRed', 'brightRed'],
  ['bGrn', 'brightGreen'], ['bYel', 'brightYellow'],
  ['bBlu', 'brightBlue'], ['bMag', 'brightMagenta'],
  ['bCya', 'brightCyan'], ['bWht', 'brightWhite'],
]

const DEFAULT_THEME = {
  background: '#0e0e1a', foreground: '#d0d0d0', cursor: '#e0e0e0',
  selectionBackground: '#334',
  black: '#1a1a2e', red: '#e57373', green: '#81c784', yellow: '#ffd54f',
  blue: '#64b5f6', magenta: '#ce93d8', cyan: '#4dd0e1', white: '#d0d0d0',
  brightBlack: '#444', brightRed: '#ef9a9a', brightGreen: '#a5d6a7',
  brightYellow: '#fff176', brightBlue: '#90caf9', brightMagenta: '#e1bee7',
  brightCyan: '#80deea', brightWhite: '#f5f5f5',
}

const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'className') e.className = v
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v)
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v)
    else e.setAttribute(k, v)
  }
  for (const c of kids) e.append(c)
  return e
}
const txt = (s) => document.createTextNode(s)

export function activate(aether) {
  let modal = null
  let colorEditorOpen = false

  /* ── Modal lifecycle ── */

  function open() {
    if (modal) return
    modal = buildModal()
    document.body.appendChild(modal)
    // Focus first input
    const first = modal.querySelector('select, input')
    if (first) setTimeout(() => first.focus(), 50)
    // Esc to close
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    modal._closeHandler = onKey
  }

  function close() {
    if (!modal) return
    if (modal._closeHandler) document.removeEventListener('keydown', modal._closeHandler)
    modal.remove()
    modal = null
  }

  /* ── Build modal DOM ── */

  function buildModal() {
    const ff = aether.settings.get('font_family') || FONTS[0].v
    const fs = aether.settings.get('font_size') || 14

    // Font select
    const fontSel = h('select', { className: 'ts-select' })
    fontSel.value = ff
    for (const f of FONTS) {
      fontSel.appendChild(h('option', { value: f.v }, txt(f.l)))
    }
    fontSel.addEventListener('change', () => aether.settings.set('font_family', fontSel.value))

    // Size slider
    const range = h('input', { type: 'range', min: '10', max: '24', step: '1' })
    range.value = String(fs)
    const valSpan = h('span', { className: 'ts-size-value' }, txt(fs + 'px'))
    range.addEventListener('input', () => {
      const sz = Number(range.value)
      valSpan.textContent = sz + 'px'
      aether.settings.set('font_size', sz)
    })

    // Theme select
    const themeSel = h('select', { className: 'ts-select' })
    const currentTheme = aether.settings.get('theme') || 'aether-dark'
    loadThemeList(themeSel, currentTheme)
    themeSel.addEventListener('change', () => {
      aether.settings.set('theme', themeSel.value)
    })

    // Edit colors toggle
    const editBtn = h('button', { className: 'sm-edit-colors' }, txt('Edit Colors'))
    const colorGrid = h('div', { className: 'sm-color-grid', style: { display: 'none' } })
    let themeColors = { ...DEFAULT_THEME }
    editBtn.addEventListener('click', () => {
      colorEditorOpen = !colorEditorOpen
      colorGrid.style.display = colorEditorOpen ? 'grid' : 'none'
      editBtn.textContent = colorEditorOpen ? '▾ Edit Colors' : '▸ Edit Colors'
      if (colorEditorOpen) loadThemeColors(themeColors, colorGrid, aether)
    })

    // Color rows populated lazily on expand (see loadThemeColors)

    // Reset button
    const resetBtn = h('button', { className: 'sm-reset-btn' }, txt('Reset to preset'))
    resetBtn.addEventListener('click', async () => {
      const name = themeSel.value
      if (name === 'aether-dark') {
        Object.assign(themeColors, DEFAULT_THEME)
      } else {
        try {
          const raw = await aether.api.invoke('read_theme_file', { name })
          Object.assign(themeColors, JSON.parse(raw))
        } catch { Object.assign(themeColors, DEFAULT_THEME) }
      }
      renderColorGrid(themeColors, colorGrid, aether)
      applyThemeToTerminal(themeColors, aether)
    })

    return h('div', { className: 'settings-modal-overlay' },
      h('div', { className: 'settings-modal' },
        h('div', { className: 'settings-modal-header' }, txt('⚙ aether settings')),
        h('div', { className: 'settings-modal-body' },
          // Font Family
          h('div', { className: 'sm-row' },
            h('span', { className: 'sm-label' }, txt('Font Family')),
            fontSel,
          ),
          // Font Size
          h('div', { className: 'sm-row' },
            h('span', { className: 'sm-label' }, txt('Font Size')),
            h('div', { className: 'ts-size-control' }, range, valSpan),
          ),
          // Theme
          h('div', { className: 'sm-row' },
            h('span', { className: 'sm-label' }, txt('Theme')),
            h('div', { className: 'sm-theme-row' }, themeSel, editBtn),
            colorGrid,
            resetBtn,
          ),
        ),
        h('div', { className: 'settings-modal-footer' }, txt('Esc close · Tab nav')),
      ),
    )
  }

  /* ── Theme helpers ── */

  async function loadThemeList(sel, current) {
    try {
      const themes = await aether.api.invoke('list_themes')
      sel.innerHTML = ''
      for (const t of themes) {
        sel.appendChild(h('option', { value: t }, txt(t)))
      }
      sel.value = current
    } catch {
      sel.innerHTML = '<option value="aether-dark">aether-dark</option>'
    }
  }

  async function loadThemeColors(colors, grid, aether) {
    const name = aether.settings.get('theme') || 'aether-dark'
    try {
      const raw = await aether.api.invoke('read_theme_file', { name })
      Object.assign(colors, JSON.parse(raw))
    } catch {
      Object.assign(colors, DEFAULT_THEME)
    }
    renderColorGrid(colors, grid, aether)
  }

  function renderColorGrid(colors, grid, aether) {
    grid.innerHTML = ''
    for (const [label, key] of COLOR_KEYS) {
      const val = colors[key] || '#000'
      const swatch = h('span', { className: 'sm-swatch', style: { background: val } })
      const input = h('input', {
        className: 'sm-hex-input',
        type: 'text',
        maxLength: '7',
        value: val,
        onInput: () => {
          const v = input.value
          if (/^#[0-9a-f]{6}$/i.test(v)) {
            swatch.style.background = v
            colors[key] = v
            applyThemeToTerminal(colors, aether)
          }
        },
      })
      const lbl = h('span', { className: 'sm-color-label' }, txt(label))
      const row = h('div', { className: 'sm-color-row' }, lbl, swatch, input)
      grid.appendChild(row)
    }
  }

  function applyThemeToTerminal(colors, aether) {
    const theme = {}
    for (const [, key] of COLOR_KEYS) {
      if (colors[key]) theme[key] = colors[key]
    }
    aether.events.emit('settings:changed', { key: 'theme', value: theme })
  }

  /* ── Commands ── */

  aether.commands.register('builtin:open-settings', {
    label: 'Open Settings',
    category: 'Built-in',
    handler: () => open(),
  })

  // Ctrl+, hotkey
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault()
      e.stopPropagation()
      open()
    }
  }, true)
}

export function deactivate() {
  const overlay = document.querySelector('.settings-modal-overlay')
  if (overlay) overlay.remove()
}
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -15
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/settings/
git commit -m "feat(settings): telescope-style modal overlay replaces inline + full-page"
```

---

### Task 3: Terminal — react to theme changes

**Files:**
- Modify: `src/core/terminal.js`

The terminal already has a `settings:changed` listener for `font_size` and `font_family`. Add `theme` handler.

- [ ] **Step 1: Add theme handling to existing listener**

In `src/core/terminal.js`, find the `settings:changed` listener and add `theme` handling:

```js
    const onSetting = events.on('settings:changed', ({ key, value }) => {
      if (!term) return
      if (key === 'font_size') {
        term.options.fontSize = value
        requestAnimationFrame(() => { try { fit.fit() } catch (_) {} })
      } else if (key === 'font_family') {
        term.options.fontFamily = value
      } else if (key === 'theme') {
        // value is a theme object { background, foreground, cursor, ... }
        term.options.theme = value
      }
    })
    cleanups.push(onSetting)
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/terminal.js
git commit -m "feat(terminal): react to theme changes via settings:changed event"
```

---

### Task 4: Toolbar — remove settings panel div

**Files:**
- Modify: `src/plugins/toolbar/main.js`

The toolbar no longer needs to create the `.terminal-settings-panel` div since the modal replaces the inline panel.

- [ ] **Step 1: Remove settingsPanel from toolbar render**

In `src/plugins/toolbar/main.js`, `render()` function:

Remove:
```js
const settingsPanel = h('div', {
    className: 'terminal-settings-panel',
    style: { display: 'none' },
})
root.appendChild(settingsPanel)
```

And update the stored reference:
```js
window.__aether_toolbar = { toolbarEl, tabEl, rightEl, container }
```

(Remove `settingsPanel` from the object.)

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/toolbar/main.js
git commit -m "refactor(toolbar): remove settings panel div (replaced by modal)"
```

---

### Task 5: Cleanup — remove `.terminal-settings-panel` CSS from toolbar style.css

**Files:**
- Modify: `src/plugins/toolbar/style.css`

The CSS for `.terminal-settings-panel` is no longer needed since no plugin creates that element.

- [ ] **Step 1: Remove `.terminal-settings-panel` CSS rules**

Delete these lines from `src/plugins/toolbar/style.css`:

```css
/* Settings panel (between toolbar and terminal) */
.terminal-settings-panel {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: var(--aether-chromeBg, #14142a);
  border-bottom: 1px solid var(--aether-chromeBorder, #2a2a3e);
  flex-shrink: 0;
  flex-wrap: wrap;
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/toolbar/style.css
git commit -m "refactor(toolbar): remove dead .terminal-settings-panel CSS"
```

---

### Task 6: Verify full build

- [ ] **Step 1: Full production build**

```bash
npm run build 2>&1
```

Expected: exit code 0, all chunks compile.

- [ ] **Step 2: Git status check**

```bash
git status
```

Expected: only the planned files modified, no stray changes.

- [ ] **Step 3: Push**

```bash
git push origin main
```