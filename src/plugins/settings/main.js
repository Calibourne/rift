/**
 * @rift/settings
 *
 * Two UIs:
 *   1. Quick modal (Ctrl+,) — font, size, theme. Fast access.
 *   2. Side panel (toolbar button) — General + Keybindings tabs.
 *
 * Quick modal stays lean. Side panel has the full experience.
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

// ── Keybinding helpers (mirrors keybindings.js) ──

function normalizeKeyEvent(e) {
  const parts = []
  if (e.ctrlKey || e.metaKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  parts.push(e.key.toLowerCase())
  return parts.join('+')
}

function prettyCombo(combo) {
  if (!combo) return null
  return combo
    .split('+')
    .map(p => p === 'ctrl' ? 'Ctrl' : p.charAt(0).toUpperCase() + p.slice(1))
    .join('+')
}

export function activate(rift) {
  // ────────────────────────────────────────────
  // Quick settings modal (unchanged behaviour)
  // ────────────────────────────────────────────

  let modal = null
  let colorEditorOpen = false

  function openModal() {
    if (modal) return
    modal = buildModal()
    document.body.appendChild(modal)
    const first = modal.querySelector('select, input')
    if (first) setTimeout(() => first.focus(), 50)
    const onKey = (e) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', onKey)
    modal._closeHandler = onKey
  }

  function closeModal() {
    if (!modal) return
    if (modal._closeHandler) document.removeEventListener('keydown', modal._closeHandler)
    modal.remove()
    modal = null
  }

  function buildModal() {
    const ff = rift.settings.get('font_family') || FONTS[0].v
    const fs = rift.settings.get('font_size') || 14

    const fontSel = h('select', { className: 'ts-select' })
    fontSel.value = ff
    for (const f of FONTS) {
      fontSel.appendChild(h('option', { value: f.v }, txt(f.l)))
    }
    fontSel.addEventListener('change', () => rift.settings.set('font_family', fontSel.value))

    const range = h('input', { type: 'range', min: '10', max: '24', step: '1' })
    range.value = String(fs)
    const valSpan = h('span', { className: 'ts-size-value' }, txt(fs + 'px'))
    range.addEventListener('input', () => {
      const sz = Number(range.value)
      valSpan.textContent = sz + 'px'
      rift.settings.set('font_size', sz)
    })

    const themeSel = h('select', { className: 'ts-select' })
    const currentTheme = rift.settings.get('theme_name') || 'rift-dark'
    loadThemeList(themeSel, currentTheme)
    themeSel.addEventListener('change', () => {
      applyNamedTheme(themeSel.value)
    })

    const editBtn = h('button', { className: 'sm-edit-colors' }, txt('▸ Edit Colors'))
    const colorGrid = h('div', { className: 'sm-color-grid', style: { display: 'none' } })
    const themeColors = { ...DEFAULT_THEME }
    editBtn.addEventListener('click', () => {
      colorEditorOpen = !colorEditorOpen
      colorGrid.style.display = colorEditorOpen ? 'grid' : 'none'
      editBtn.textContent = colorEditorOpen ? '▾ Edit Colors' : '▸ Edit Colors'
      if (colorEditorOpen) loadThemeColors(themeColors, colorGrid)
    })

    const resetBtn = h('button', { className: 'sm-reset-btn' }, txt('Reset to preset'))
    resetBtn.addEventListener('click', async () => {
      const name = themeSel.value
      const theme = rift.ui.getTheme(name)
      if (theme) {
        Object.assign(themeColors, theme.colors)
      } else if (name === 'rift-dark') {
        Object.assign(themeColors, DEFAULT_THEME)
      } else {
        try {
          const raw = await rift.api.invoke('read_theme_file', { name })
          Object.assign(themeColors, JSON.parse(raw))
        } catch { Object.assign(themeColors, DEFAULT_THEME) }
      }
      renderColorGrid(themeColors, colorGrid)
      applyThemeToTerminal(themeColors)
    })

    return h('div', { className: 'settings-modal-overlay' },
      h('div', { className: 'settings-modal' },
        h('div', { className: 'settings-modal-header' }, txt('Quick Settings')),
        h('div', { className: 'settings-modal-body' },
          h('div', { className: 'sm-row' },
            h('span', { className: 'sm-label' }, txt('Font Family')),
            fontSel,
          ),
          h('div', { className: 'sm-row' },
            h('span', { className: 'sm-label' }, txt('Font Size')),
            h('div', { className: 'ts-size-control' }, range, valSpan),
          ),
          h('div', { className: 'sm-row' },
            h('span', { className: 'sm-label' }, txt('Theme')),
            h('div', { className: 'sm-theme-row' }, themeSel, editBtn),
            colorGrid,
            resetBtn,
          ),
        ),
        h('div', { className: 'settings-modal-footer' }, txt('Esc close · Side panel for keybindings')),
      ),
    )
  }

  async function loadThemeList(sel, current) {
    try {
      const fileThemes = await rift.api.invoke('list_themes')
      const builtinThemes = rift.ui.listThemes()
      const seen = new Set()
      sel.innerHTML = ''
      for (const t of [...fileThemes, ...builtinThemes]) {
        if (seen.has(t)) continue
        seen.add(t)
        sel.appendChild(h('option', { value: t }, txt(t)))
      }
      sel.value = current
    } catch {
      sel.innerHTML = '<option value="rift-dark">rift-dark</option>'
    }
  }

  function applyNamedTheme(name) {
    rift.settings.set('theme_name', name)
    rift.ui.applyTheme(name)
    const theme = rift.ui.getTheme(name)
    if (theme) {
      const colors = theme.colors
      const termTheme = {}
      for (const [, key] of COLOR_KEYS) {
        if (colors[key]) termTheme[key] = colors[key]
      }
      applyThemeToTerminal(termTheme)
    }
  }

  async function loadThemeColors(colors, grid) {
    const name = rift.settings.get('theme_name') || 'rift-dark'
    const theme = rift.ui.getTheme(name)
    if (theme) {
      Object.assign(colors, theme.colors)
      const termTheme = {}
      for (const [, key] of COLOR_KEYS) {
        if (colors[key]) termTheme[key] = colors[key]
      }
      applyThemeToTerminal(termTheme)
    } else {
      try {
        const raw = await rift.api.invoke('read_theme_file', { name })
        Object.assign(colors, JSON.parse(raw))
      } catch {
        Object.assign(colors, DEFAULT_THEME)
      }
    }
    renderColorGrid(colors, grid)
  }

  function renderColorGrid(colors, grid) {
    grid.innerHTML = ''
    for (const [label, key] of COLOR_KEYS) {
      const val = colors[key] || '#000'
      const swatch = h('span', { className: 'sm-swatch', style: { background: val } })
      const input = h('input', {
        className: 'sm-hex-input',
        type: 'text', maxLength: '7', value: val,
        onInput: () => {
          const v = input.value
          if (/^#[0-9a-f]{6}$/i.test(v)) {
            swatch.style.background = v
            colors[key] = v
            applyThemeToTerminal(colors)
          }
        },
      })
      const lbl = h('span', { className: 'sm-color-label' }, txt(label))
      const row = h('div', { className: 'sm-color-row' }, lbl, swatch, input)
      grid.appendChild(row)
    }
  }

  function applyThemeToTerminal(colors) {
    const theme = {}
    for (const [, key] of COLOR_KEYS) {
      if (colors[key]) theme[key] = colors[key]
    }
    rift.events.emit('settings:changed', { key: 'theme', value: theme })
  }

  // ────────────────────────────────────────────
  // Settings side panel (General + Keys tabs)
  // ────────────────────────────────────────────

  let panelEl = null
  let tabContents = {}
  let activeTab = 'general'
  let capturing = null
  // Keybinding capture handler ref for cleanup
  let captureHandler = null

  function buildPanel() {
    panelEl = h('div', { className: 'sp-panel' })

    // ── Tab bar ──
    const tabBar = h('div', { className: 'sp-tab-bar' })

    const generalTab = h('button', {
      className: 'sp-tab sp-tab-active',
      'data-tab': 'general',
      onClick: () => switchTab('general'),
    }, txt('General'))

    const keysTab = h('button', {
      className: 'sp-tab',
      'data-tab': 'keys',
      onClick: () => switchTab('keys'),
    }, txt('Keys'))

    tabBar.appendChild(generalTab)
    tabBar.appendChild(keysTab)

    // ── Tab content containers ──
    const content = h('div', { className: 'sp-content' })

    // General tab
    const generalEl = h('div', { className: 'sp-tab-content sp-tab-content-active', 'data-tab': 'general' })
    tabContents.general = buildGeneralTab(generalEl)

    // Keys tab
    const keysEl = h('div', { className: 'sp-tab-content', 'data-tab': 'keys' })
    tabContents.keys = buildKeysTab(keysEl)

    content.appendChild(generalEl)
    content.appendChild(keysEl)

    panelEl.appendChild(tabBar)
    panelEl.appendChild(content)

    return panelEl
  }

  // ── General tab (font, theme) ──

  function buildGeneralTab(container) {
    const ff = rift.settings.get('font_family') || FONTS[0].v
    const fs = rift.settings.get('font_size') || 14

    const fontSel = h('select', { className: 'sp-select' })
    fontSel.value = ff
    for (const f of FONTS) {
      fontSel.appendChild(h('option', { value: f.v }, txt(f.l)))
    }
    fontSel.addEventListener('change', () => rift.settings.set('font_family', fontSel.value))

    const range = h('input', { type: 'range', min: '10', max: '24', step: '1' })
    range.value = String(fs)
    const valSpan = h('span', { className: 'sp-size-value' }, txt(fs + 'px'))
    range.addEventListener('input', () => {
      const sz = Number(range.value)
      valSpan.textContent = sz + 'px'
      rift.settings.set('font_size', sz)
    })

    // Theme section simplified — just the selector for the side panel
    const themeSel = h('select', { className: 'sp-select' })
    const currentTheme = rift.settings.get('theme_name') || 'rift-dark'
    loadThemeList(themeSel, currentTheme)
    themeSel.addEventListener('change', () => applyNamedTheme(themeSel.value))

    container.innerHTML = ''
    container.appendChild(h('div', { className: 'sp-section' },
      h('div', { className: 'sp-section-title' }, txt('TERMINAL')),
      h('div', { className: 'sp-field' },
        h('label', { className: 'sp-label' }, txt('Font Family')),
        fontSel,
      ),
      h('div', { className: 'sp-field' },
        h('label', { className: 'sp-label' }, txt('Font Size')),
        h('div', { className: 'sp-size-row' }, range, valSpan),
      ),
      h('div', { className: 'sp-field' },
        h('label', { className: 'sp-label' }, txt('Theme')),
        themeSel,
      ),
    ))

    return container
  }

  // ── Keys tab (keybinding editor) ──

  function buildKeysTab(container) {
    const searchEl = h('input', {
      className: 'sp-search',
      type: 'text',
      placeholder: 'Search commands\u2026',
      onInput: () => renderKeyList(searchEl, listEl, statusEl),
      onKeyDown: (e) => { if (e.key === 'Escape') searchEl.blur() },
    })

    const listEl = h('div', { className: 'sp-key-list' })
    const statusEl = h('div', { className: 'sp-key-status' }, txt('Click a command, then press a key combo'))

    container.innerHTML = ''
    container.appendChild(h('div', { className: 'sp-search-wrap' }, searchEl))
    container.appendChild(listEl)
    container.appendChild(statusEl)

    // Initial render (defer so DOM is attached)
    requestAnimationFrame(() => renderKeyList(searchEl, listEl, statusEl))

    return { searchEl, listEl, statusEl }
  }

  function renderKeyList(searchEl, listEl, statusEl) {
    if (!listEl) return
    const filter = (searchEl?.value || '').toLowerCase()
    const commands = rift.commands.list()
    const bindings = loadBindings()

    let shown = commands
    if (filter) {
      shown = commands.filter(c =>
        c.label.toLowerCase().includes(filter) ||
        c.id.toLowerCase().includes(filter) ||
        (c.category || '').toLowerCase().includes(filter)
      )
    }

    shown = [...shown].sort((a, b) => {
      const aBound = bindings[a.id] ? 0 : 1
      const bBound = bindings[b.id] ? 0 : 1
      if (aBound !== bBound) return aBound - bBound
      const cat = (a.category || '').localeCompare(b.category || '')
      if (cat !== 0) return cat
      return a.label.localeCompare(b.label)
    })

    listEl.innerHTML = ''
    if (shown.length === 0) {
      listEl.appendChild(h('div', { style: { padding: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--rift-textMuted, #666)' } }, txt('No matching commands')))
      return
    }

    let lastCat = null
    for (const cmd of shown) {
      const cat = cmd.category || ''
      if (cat !== lastCat) {
        lastCat = cat
        listEl.appendChild(h('div', { className: 'sp-key-cat' }, txt(cat)))
      }

      const isCapturing = capturing === cmd.id
      const bound = bindings[cmd.id]

      const comboEl = h('span', {
        className: 'sp-key-combo' + (isCapturing ? ' capturing' : '') + (bound ? '' : ' unbound'),
      }, txt(isCapturing ? 'Press keys\u2026' : (prettyCombo(bound) || '\u2014')))

      const unbindBtn = h('button', {
        className: 'sp-key-unbind',
        onClick: (e) => { e.stopPropagation(); unbindCommand(cmd.id, searchEl, listEl, statusEl) },
      }, bound ? txt('\u2716') : txt(''))

      const row = h('div', {
        className: 'sp-key-row' + (isCapturing ? ' capturing' : ''),
        onClick: () => startCapture(cmd.id, searchEl, listEl, statusEl),
      },
        h('span', { className: 'sp-key-label' }, txt(cmd.label)),
        comboEl,
        unbindBtn,
      )
      listEl.appendChild(row)
    }
  }

  function loadBindings() {
    // Read from the runtime registry — includes both defaults and
    // user overrides from settings.  getCombo() gives the active combo
    // for a command ID regardless of how it was registered.
    const map = {}
    for (const cmd of rift.commands.list()) {
      const combo = rift.keybindings.getCombo(cmd.id)
      if (combo) map[cmd.id] = combo
    }
    return map
  }

  function startCapture(commandId, searchEl, listEl, statusEl) {
    if (capturing === commandId) {
      capturing = null
      renderKeyList(searchEl, listEl, statusEl)
      return
    }

    // Clean up old capture handler
    if (captureHandler) {
      document.removeEventListener('keydown', captureHandler, true)
    }

    capturing = commandId
    renderKeyList(searchEl, listEl, statusEl)
    if (statusEl) { statusEl.textContent = 'Press a key combination\u2026'; statusEl.className = 'sp-key-status' }

    captureHandler = (e) => {
      if (e.key === 'Escape') {
        capturing = null
        renderKeyList(searchEl, listEl, statusEl)
        if (statusEl) statusEl.textContent = 'Cancelled'
        document.removeEventListener('keydown', captureHandler, true)
        captureHandler = null
        return
      }

      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return

      e.preventDefault()
      e.stopPropagation()
      document.removeEventListener('keydown', captureHandler, true)
      captureHandler = null

      const combo = normalizeKeyEvent(e)
      const bindings = loadBindings()
      const existingCmd = Object.entries(bindings).find(([cmdId, cmdCombo]) => cmdCombo === combo && cmdId !== commandId)

      if (existingCmd) {
        const conflictCmd = rift.commands.list().find(c => c.id === existingCmd[0])
        const label = conflictCmd ? conflictCmd.label : existingCmd[0]
        if (!confirm(`"${prettyCombo(combo)}" is already bound to "${label}". Override?`)) {
          capturing = null
          renderKeyList(searchEl, listEl, statusEl)
          return
        }
      }

      // Save
      const raw = rift.settings.get('keybindings') || {}
      const updated = { ...raw }
      for (const [c, id] of Object.entries(updated)) {
        if (id === commandId) delete updated[c]
      }
      updated[combo] = commandId
      saveBindings(updated)
      if (statusEl) { statusEl.textContent = `Bound ${prettyCombo(combo)}`; statusEl.className = 'sp-key-status saved' }
      capturing = null
      renderKeyList(searchEl, listEl, statusEl)
    }

    document.addEventListener('keydown', captureHandler, true)
  }

  function unbindCommand(commandId, searchEl, listEl, statusEl) {
    const raw = rift.settings.get('keybindings') || {}
    const updated = { ...raw }
    for (const [c, id] of Object.entries(updated)) {
      if (id === commandId) {
        delete updated[c]
        rift.keybindings.unregister(c)
      }
    }
    saveBindings(updated)
    if (statusEl) { statusEl.textContent = `Unbound ${commandId}`; statusEl.className = 'sp-key-status saved' }
    renderKeyList(searchEl, listEl, statusEl)
  }

  function saveBindings(bindings) {
    rift.settings.set('keybindings', bindings)
    for (const [combo, commandId] of Object.entries(bindings)) {
      rift.keybindings.set(combo, commandId)
    }
  }

  // ── Tab switching ──

  function switchTab(name) {
    activeTab = name

    // Cancel any active capture
    if (captureHandler) {
      document.removeEventListener('keydown', captureHandler, true)
      captureHandler = null
    }
    capturing = null

    const tabs = panelEl?.querySelectorAll('.sp-tab')
    const contents = panelEl?.querySelectorAll('.sp-tab-content')
    tabs?.forEach(t => t.classList.toggle('sp-tab-active', t.dataset.tab === name))
    contents?.forEach(c => c.classList.toggle('sp-tab-content-active', c.dataset.tab === name))

    // Refresh key list when switching to Keys tab
    if (name === 'keys' && tabContents.keys) {
      const { searchEl, listEl, statusEl } = tabContents.keys
      renderKeyList(searchEl, listEl, statusEl)
    }
  }

  // ── Register panel ──

  const panelElement = buildPanel()
  rift.ui.addPanel({
    id: 'settings',
    title: 'Settings',
    side: 'right',
    element: panelElement,
    icon: '\u2699', // gear
  })

  // Re-render key list when commands change (e.g. shells register after boot)
  rift.events.on('plugin:activated', () => {
    if (activeTab === 'keys' && tabContents.keys) {
      const { searchEl, listEl, statusEl } = tabContents.keys
      if (listEl) renderKeyList(searchEl, listEl, statusEl)
    }
  })

  // Render key list when panel opens
  rift.events.on('ui:panel-toggled', ({ id, visible }) => {
    if (id === 'settings' && visible && activeTab === 'keys' && tabContents.keys) {
      const { searchEl, listEl, statusEl } = tabContents.keys
      renderKeyList(searchEl, listEl, statusEl)
    }
    if (id === 'settings' && visible) {
      setTimeout(() => tabContents.keys?.searchEl?.focus(), 100)
    }
  })

  // ── Commands ──

  rift.commands.register('builtin:quick-settings', {
    label: 'Quick Settings',
    category: 'Built-in',
    handler: () => openModal(),
  })

  rift.commands.register('builtin:toggle-settings-panel', {
    label: 'Toggle Settings Panel',
    category: 'Built-in',
    handler: () => rift.ui.togglePanel('settings'),
  })

  // Ctrl+, opens quick modal
  rift.keybindings.register('ctrl+,', 'builtin:quick-settings')

  // Ctrl+K opens settings side panel
  rift.keybindings.register('ctrl+k', 'builtin:toggle-settings-panel')
}

export function deactivate() {
  if (captureHandler) {
    document.removeEventListener('keydown', captureHandler, true)
  }
  const overlay = document.querySelector('.settings-modal-overlay')
  if (overlay) overlay.remove()
}