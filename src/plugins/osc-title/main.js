/**
 * @rift/osc-title
 *
 * Hooks onTitleChange from the terminal and updates document.title.
 * OSC 0 and OSC 1 escape sequences set the terminal tab/window title.
 * Falls back to shell name when no OSC title is set.
 */

export function activate(rift) {
  // Set title from OSC sequences
  rift.terminal.onTitleChange(title => {
    if (title) {
      document.title = title + ' — Rift'
    }
  })

  // Update fallback on shell selection
  rift.events.on('shell:selected', (shell) => {
    if (shell && shell.name) {
      document.title = shell.name + ' — Rift'
    }
  })

  // Update on session switch
  rift.events.on('session:switched', ({ id }) => {
    const info = rift.terminal.getInfo(id)
    if (info && info.shell) {
      document.title = info.shell.name + ' — Rift'
    }
  })
}

export function deactivate() {
  document.title = 'Rift'
}
