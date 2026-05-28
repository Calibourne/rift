/**
 * @rift/clipboard
 *
 * Ctrl+Shift+C copies selected text from terminal to system clipboard.
 * Ctrl+Shift+V pastes system clipboard text into the terminal.
 *
 * Falls back gracefully if clipboard API is unavailable (no secure context).
 */

export function activate(rift) {
  // ── Copy: Ctrl+Shift+C ──
  rift.keybindings.register('ctrl+shift+c', () => {
    const sel = rift.terminal.getSelection()
    if (!sel) return
    navigator.clipboard.writeText(sel).catch(() => {
      // Clipboard API unavailable — try document.execCommand fallback
      try {
        const ta = document.createElement('textarea')
        ta.value = sel
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      } catch (_) {
        // No clipboard available at all
      }
    })
  })

  // ── Paste: Ctrl+Shift+V ──
  rift.keybindings.register('ctrl+shift+v', async () => {
    try {
      const text = await navigator.clipboard.readText()
      rift.terminal.write(text)
    } catch {
      // Clipboard read not available
    }
  })
}
