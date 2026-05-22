/**
 * @aether/settings
 *
 * Two modes:
 *   1. Inline panel — slides down from toolbar (font + size quick controls)
 *   2. Full page — standalone settings view
 *
 * Both control the same underlying settings store.
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
  let inlineVisible = false

  /* ── Inline panel (populates toolbar's .terminal-settings-panel) ── */

  function injectInlinePanel() {
    const panel = document.querySelector('.terminal-settings-panel')
    if (!panel || panel.querySelector('.ts-setting')) return

    // Font selector
    const fontSel = h('select', { className: 'ts-select' })
    fontSel.value = aether.settings.get('font_family') || FONTS[0].v
    for (const f of FONTS) {
      const opt = h('option', { value: f.v }, txt(f.l))
      fontSel.appendChild(opt)
    }
    fontSel.addEventListener('change', () => {
      aether.settings.set('font_family', fontSel.value)
    })

    const fontLbl = h('label', { className: 'ts-setting' },
      h('span', { className: 'ts-label' }, txt('Font')), fontSel
    )
    panel.appendChild(fontLbl)

    // Size slider
    const range = h('input', { type: 'range', min: '10', max: '24', step: '1' })
    range.value = String(aether.settings.get('font_size') || 14)
    const valSpan = h('span', { className: 'ts-size-value' }, txt(range.value + 'px'))

    range.addEventListener('input', () => {
      const sz = Number(range.value)
      valSpan.textContent = sz + 'px'
      aether.settings.set('font_size', sz)
    })

    const sizeCtrl = h('div', { className: 'ts-size-control' }, range, valSpan)
    const sizeLbl = h('label', { className: 'ts-setting' },
      h('span', { className: 'ts-label' }, txt('Size')), sizeCtrl
    )
    panel.appendChild(sizeLbl)
  }

  function toggleInlinePanel() {
    inlineVisible = !inlineVisible
    let panel = document.querySelector('.terminal-settings-panel')
    if (!panel) return
    injectInlinePanel()
    panel.style.display = inlineVisible ? 'flex' : 'none'
  }

  // Debug: log when toggle is executed
  console.log('[settings] plugin activated, toggle-settings-panel command registered')

  /* ── Full settings page ── */

  function renderFullPage() {
    const root = document.getElementById('root')
    if (!root) return
    root.innerHTML = ''
    root.classList.remove('shell-selector-mode', 'terminal-mode')

    let ff = aether.settings.get('font_family') || FONTS[0].v
    let fs = aether.settings.get('font_size') || 14

    const header = h('div', { className: 'settings-header' },
      h('button', {
        className: 'back-btn',
        onClick: () => {
          const def = aether.settings.get('default_shell')
          if (def && def.path) {
            aether.events.emit('app:phase', 'terminal')
            aether.events.emit('shell:selected', def)
          } else {
            aether.events.emit('app:phase', 'select')
          }
        },
      }, txt('\u2190 Back')),
      h('h1', {}, txt('Settings'))
    )

    const errorP = h('p', { className: 'settings-error' })
    const saveBtn = h('button', { className: 'save-btn' }, txt('Save'))

    const previewBox = h('div', {
      className: 'preview-box',
      style: { fontFamily: ff, fontSize: fs + 'px', lineHeight: 1.5 },
    },
      h('div', { className: 'preview-header' }, txt('Preview')),
      h('div', {},
        h('span', { style: { color: '#e57373' } }, txt('\u03bb ')),
        h('span', { style: { color: '#81c784' } }, txt('~ ')),
        h('span', { style: { color: '#64b5f6' } }, txt('echo ')),
        h('span', { style: { color: '#ffd54f' } }, txt('"hello from nf"'))
      ),
      h('div', { style: { color: '#888' } }, txt('\u279c ~ ls -la')),
      h('div', { style: { color: '#888', fontSize: fs - 2 } },
        txt('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 /home/user \u2500'))
    )

    const fontSel = h('select', { className: 'font-picker' })
    fontSel.value = ff
    for (const f of FONTS) {
      const opt = h('option', { value: f.v }, txt(f.l))
      fontSel.appendChild(opt)
    }
    fontSel.addEventListener('change', () => {
      ff = fontSel.value
      previewBox.style.fontFamily = ff
    })

    const range = h('input', { type: 'range', min: '10', max: '24', step: '1' })
    range.value = String(fs)
    const valSpan = h('span', { className: 'size-value' }, txt(fs + 'px'))
    range.addEventListener('input', () => {
      fs = Number(range.value)
      valSpan.textContent = fs + 'px'
      previewBox.style.fontSize = fs + 'px'
      const last = previewBox.lastElementChild
      if (last) last.style.fontSize = (fs - 2) + 'px'
    })

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true
      saveBtn.textContent = 'Saving\u2026'
      errorP.textContent = ''
      try {
        await aether.settings.set('font_family', ff)
        await aether.settings.set('font_size', fs)
        const def = aether.settings.get('default_shell')
        if (def && def.path) {
          aether.events.emit('app:phase', 'terminal')
          aether.events.emit('shell:selected', def)
        } else {
          aether.events.emit('app:phase', 'select')
        }
      } catch (e) {
        errorP.textContent = String(e)
        saveBtn.disabled = false
        saveBtn.textContent = 'Save'
      }
    })

    const body = h('div', { className: 'settings-body' },
      h('label', { className: 'setting-row' },
        h('span', { className: 'setting-label' }, txt('Terminal font')), fontSel
      ),
      h('label', { className: 'setting-row' },
        h('span', { className: 'setting-label' }, txt('Font size')),
        h('div', { className: 'size-control' }, range, valSpan)
      ),
      previewBox,
      errorP,
      saveBtn
    )

    root.appendChild(header)
    root.appendChild(body)
  }

  /* ── Commands ── */

  aether.commands.register('builtin:open-settings', {
    label: 'Open Settings',
    category: 'Built-in',
    handler: () => renderFullPage(),
  })

  aether.commands.register('builtin:toggle-settings-panel', {
    label: 'Toggle Settings Panel',
    category: 'Built-in',
    handler: () => toggleInlinePanel(),
  })
}

export function deactivate() {
  // No-op
}