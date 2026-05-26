/**
 * @rift/shell-selector
 *
 * Renders a grid of detected shells.  Clicking a shell opens a terminal.
 * This is the initial screen shown on app boot.
 */

import './style.css'

const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v)
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v)
    else e.setAttribute(k, v)
  }
  for (const c of kids) e.append(c)
  return e
}
const txt = (s) => document.createTextNode(s)

export function activate(rift) {
  let rootEl = null
  let switchModal = null

  function render() {
    const root = document.getElementById('root')
    if (!root) return
    root.innerHTML = ''
    rootEl = root

    root.classList.add('shell-selector-mode')

    const header = h('div', { className: 'selector-header' },
      h('h1', {}, txt('Rift')),
      h('button', {
        className: 'settings-gear',
        onClick: () => rift.commands.execute('builtin:quick-settings'),
      }, txt('\u2699'))
    )

    const sub = h('p', { className: 'subtitle' }, txt('Choose a shell to launch'))
    const errorEl = h('p', { className: 'shell-error' })
    const grid = h('div', { className: 'shell-grid' })

    const sel = h('div', { className: 'shell-selector' },
      header, sub, errorEl, grid
    )
    root.appendChild(sel)

    rift.api.invoke('list_shells').then(shells => {
      grid.innerHTML = ''
      for (const s of shells) {
        const card = h('div', {
          className: 'shell-card', role: 'button', tabIndex: '0',
          onClick: () => launch(s),
          onKeyDown: (e) => e.key === 'Enter' && launch(s),
        },
          h('span', { className: 'icon' }, txt(s.icon)),
          h('span', { className: 'name' }, txt(s.name)),
          h('span', { className: 'version' }, txt(s.version))
        )
        grid.appendChild(card)
      }
    }).catch(err => {
      errorEl.textContent = String(err)
    })
  }

  async function launch(shell) {
    try {
      const info = {
        name: shell.name,
        path: shell.path,
        args: shell.args,
      }
      rift.settings.set('default_shell', info)
      rift.events.emit('app:phase', 'terminal')
      rift.events.emit('shell:selected', info)
    } catch (e) {
      console.error('launch failed:', e)
    }
  }

  rift.events.on('app:phase', (phase) => {
    if (phase === 'select') render()
  })

  rift.commands.register('builtin:show-shell-selector', {
    label: 'Show Shell Selector',
    category: 'Built-in',
    handler: () => rift.events.emit('app:phase', 'select'),
  })

  /* ── Shell switcher modal (Ctrl+T) ── */

  function openSwitcher() {
    if (switchModal) return
    switchModal = buildSwitcher()
    document.body.appendChild(switchModal)
    const onKey = (e) => { if (e.key === 'Escape') closeSwitcher() }
    document.addEventListener('keydown', onKey)
    switchModal._closeHandler = onKey
  }

  function closeSwitcher() {
    if (!switchModal) return
    if (switchModal._closeHandler) document.removeEventListener('keydown', switchModal._closeHandler)
    switchModal.remove()
    switchModal = null
  }

  function buildSwitcher() {
    const list = h('div', { className: 'switcher-modal-list' })

    rift.api.invoke('list_shells').then(shells => {
      list.innerHTML = ''
      const activeShell = rift.terminal.getInfo()?.shell
      for (const s of shells) {
        const active = activeShell && activeShell.path === s.path
        const item = h('div', {
          className: 'switcher-item' + (active ? ' sw-active' : ''),
          onClick: () => switchTo(s),
        },
          h('span', { className: 'icon' }, txt(s.icon)),
          h('span', { className: 'sw-name' }, txt(s.name)),
          h('span', { className: 'sw-version' }, txt(s.version)),
        )
        list.appendChild(item)
      }
    }).catch(() => {
      list.innerHTML = '<div class="switcher-item">Failed to load shells</div>'
    })

    return h('div', { className: 'switcher-modal-overlay' },
      h('div', { className: 'switcher-modal' },
        h('div', { className: 'switcher-modal-header' }, txt('Switch Shell')),
        list,
        h('div', { className: 'switcher-modal-footer' }, txt('Esc close')),
      ),
    )
  }

  async function switchTo(shell) {
    closeSwitcher()
    const info = { name: shell.name, path: shell.path, args: shell.args }
    await rift.settings.set('default_shell', info)

    if (rift.terminal.isActive()) {
      await rift.terminal.close()
    }

    rift.events.emit('app:phase', 'terminal')
    rift.events.emit('shell:selected', info)
  }

  rift.commands.register('builtin:switch-shell', {
    label: 'Switch Shell',
    category: 'Built-in',
    handler: () => openSwitcher(),
  })

  rift.keybindings.register('ctrl+t', 'builtin:switch-shell')
}

export function deactivate() {
  const root = document.getElementById('root')
  if (root) root.classList.remove('shell-selector-mode')
  const modal = document.querySelector('.switcher-modal-overlay')
  if (modal) modal.remove()
}