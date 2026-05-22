/**
 * @aether/shell-selector
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

export function activate(aether) {
  let rootEl = null

  /**
   * Render the shell selector screen into #root.
   */
  function render() {
    const root = document.getElementById('root')
    if (!root) return
    root.innerHTML = ''
    rootEl = root

    root.classList.add('shell-selector-mode')

    const header = h('div', { className: 'selector-header' },
      h('h1', {}, txt('Aether')),
      h('button', {
        className: 'settings-gear',
        onClick: () => aether.commands.execute('builtin:open-settings'),
      }, txt('\u2699'))
    )

    const sub = h('p', { className: 'subtitle' }, txt('Choose a shell to launch'))
    const errorEl = h('p', { className: 'shell-error' })
    const grid = h('div', { className: 'shell-grid' })

    const sel = h('div', { className: 'shell-selector' },
      header, sub, errorEl, grid
    )
    root.appendChild(sel)

    // Fetch shells from backend
    aether.api.invoke('list_shells').then(shells => {
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
      // This signals the toolbar plugin to show the terminal view
      aether.events.emit('app:phase', 'terminal')
      // Terminal plugin should already be listening... but actually,
      // terminal.open is called by whoever handles the phase change.
      // For now, let the main render cycle handle this.
      aether.events.emit('shell:selected', info)
    } catch (e) {
      console.error('launch failed:', e)
    }
  }

  // Listen for phase changes — render when we're in select mode
  aether.events.on('app:phase', (phase) => {
    if (phase === 'select') render()
  })

  // Register the show-selector command
  aether.commands.register('builtin:show-shell-selector', {
    label: 'Show Shell Selector',
    category: 'Built-in',
    handler: () => aether.events.emit('app:phase', 'select'),
  })

  // Initial render
  render()
}

export function deactivate() {
  const root = document.getElementById('root')
  if (root) root.classList.remove('shell-selector-mode')
}