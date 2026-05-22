/**
 * @aether/settings
 *
 * Telescope-style floating modal for font, size, and theme.
 * Ctrl+, to open. Esc to close. Tab to navigate.
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
    const first = modal.querySelector('select, input')
    if (first) setTimeout(() => first.focus(), 50)
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

    const fontSel = h('select', { className: 'ts-select' })
    fontSel.value = ff
    for (const f of FONTS) {
      fontSel.appendChild(h('option', { value: f.v }, txt(f.l)))
    }
    fontSel.addEventListener('change', () => aether.settings.set('font_family', fontSel.value))

    const range = h('input', { type: 'range', min: '10', max: '24', step: '1' })
    range.value = String(fs)
    const valSpan = h('span', { className: 'ts-size-value' }, txt(fs + 'px'))
    range.addEventListener('input', () => {
      const sz = Number(range.value)
      valSpan.textContent = sz + 'px'
      aether.settings.set('font_size', sz)
    })

    const themeSel = h('select', { className: 'ts-select' })
    const currentTheme = aether.settings.get('theme') || 'aether-dark'
    loadThemeList(themeSel, currentTheme)
    themeSel.addEventListener('change', () => {
      aether.settings.set('theme', themeSel.value)
    })

    const editBtn = h('button', { className: 'sm-edit-colors' }, txt('▸ Edit Colors'))
    const colorGrid = h('div', { className: 'sm-color-grid', style: { display: 'none' } })
    const themeColors = { ...DEFAULT_THEME }
    editBtn.addEventListener('click', () => {
      colorEditorOpen = !colorEditorOpen
      colorGrid.style.display = colorEditorOpen ? 'grid' : 'none'
      editBtn.textContent = colorEditorOpen ? '▾ Edit Colors' : '▸ Edit Colors'
      if (colorEditorOpen) loadThemeColors(themeColors, colorGrid, aether)
    })

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

  // Ctrl+, hotkey (capture phase)
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