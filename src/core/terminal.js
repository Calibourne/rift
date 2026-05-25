/**
 * Rift Terminal Manager
 *
 * Wraps xterm.js and the Rust PTY IPC.  Plugins never touch Tauri invoke
 * directly — they use `rift.terminal.*`.
 *
 * The terminal module owns:
 *   - xterm.js Terminal + FitAddon lifecycle
 *   - PTY IPC (launch, write, resize, kill)
 *   - Tauri event listeners (pty-output-*, pty-exit-*)
 *   - ResizeObserver + window resize debounce
 *
 * Usage:
 *   import { terminal } from './core/terminal.js'
 *   await terminal.open(shellPath, shellArgs)
 *   terminal.write('echo hello\n')
 *   terminal.resize(80, 24)
 *   terminal.close()
 *   terminal.onInput(data => ...)
 *   terminal.getInfo() // { ptyId, shell, cols, rows }
 */

import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { events } from './event-bus.js'

function createTerminal() {
  /** @type {Terminal | null} */
  let term = null
  /** @type {FitAddon | null} */
  let fit = null
  /** @type {HTMLElement | null} */
  let container = null

  /** @type {string | null} */
  let ptyId = null
  /** @type {object | null} */
  let shell = null

  /** @type {Set<Function>} */
  const inputHandlers = new Set()
  /** @type {Set<Function>} */
  const dataHandlers = new Set()

  /** @type {Function[]} */
  let cleanups = []
  /** @type {ResizeObserver | null} */
  let resizeObserver = null
  /** @type {object | null} */
  let cachedTheme = null

  /**
   * Open a PTY session and render xterm.js into the given container.
   * @param {HTMLElement} domContainer - DOM element to mount terminal into
   * @param {object} shellInfo - { name, path, args }
   * @param {object} [options] - xterm options overrides
   * @returns {Promise<string>} ptyId
   */
  async function open(domContainer, shellInfo, options = {}) {
    // Close any existing session first
    if (ptyId) await close()

    container = domContainer
    shell = shellInfo

    // Spawn PTY on Rust side
    ptyId = await invoke('launch_shell', {
      shellPath: shellInfo.path,
      shellArgs: shellInfo.args,
    })

    // Init xterm
    fit = new FitAddon()
    term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: "'JetBrainsMono Nerd Font','JetBrains Mono','Fira Code',monospace",
      theme: cachedTheme || {
        background: '#0e0e1a', foreground: '#d0d0d0', cursor: '#e0e0e0',
        selectionBackground: '#334',
        black: '#1a1a2e', red: '#e57373', green: '#81c784', yellow: '#ffd54f',
        blue: '#64b5f6', magenta: '#ce93d8', cyan: '#4dd0e1', white: '#d0d0d0',
        brightBlack: '#444', brightRed: '#ef9a9a', brightGreen: '#a5d6a7',
        brightYellow: '#fff176', brightBlue: '#90caf9', brightMagenta: '#e1bee7',
        brightCyan: '#80deea', brightWhite: '#f5f5f5',
      },
      allowTransparency: false,
      cols: 80, rows: 24,
      // Let Ctrl+P bubble up to command palette instead of sending to PTY
      attachCustomKeyEventHandler: (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
          return false
        }
        return true
      },
      ...options,
    })
    term.loadAddon(fit)
    term.open(container)

    // Fit to container after mount
    requestAnimationFrame(() => { try { fit.fit() } catch (_) {} })

    // ── Tauri event listeners ──
    const unOut = await listen(`pty-output-${ptyId}`, ev => {
      const data = ev.payload.data
      if (term) term.write(data)
      for (const fn of dataHandlers) { try { fn(data) } catch (_) {} }
    })
    cleanups.push(unOut)

    const unExit = await listen(`pty-exit-${ptyId}`, () => {
      if (term) term.write('\r\n\x1b[31m[process exited]\x1b[0m\r\n')
      events.emit('pty:exit', { ptyId })
      // Auto-return to selector after 1.5s
      setTimeout(() => {
        if (ptyId === shellInfo.path) return // already closed
        events.emit('app:phase', 'select')
      }, 1500)
    })
    cleanups.push(unExit)

    // ── Input forwarding ──
    const disposable = term.onData(data => {
      invoke('write_pty', { ptyId, data }).catch(() => {})
      for (const fn of inputHandlers) { try { fn(data) } catch (_) {} }
    })
    cleanups.push(() => disposable.dispose())

    // ── Resize observer ──
    resizeObserver = new ResizeObserver(() => {
      if (!fit || !term) return
      try { fit.fit() } catch (_) { return }
      invoke('resize_pty', { ptyId, cols: term.cols, rows: term.rows }).catch(() => {})
    })
    resizeObserver.observe(container)
    cleanups.push(() => resizeObserver.disconnect())

    // ── Window resize (debounced) ──
    let timer
    const onWinResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!fit || !term) return
        try { fit.fit() } catch (_) { return }
        invoke('resize_pty', { ptyId, cols: term.cols, rows: term.rows }).catch(() => {})
      }, 60)
    }
    window.addEventListener('resize', onWinResize)
    cleanups.push(() => window.removeEventListener('resize', onWinResize))

    // ── React to font/family changes ──
    const onSetting = events.on('settings:changed', ({ key, value }) => {
      if (!term) return
      if (key === 'font_size') {
        term.options.fontSize = value
        requestAnimationFrame(() => { try { fit.fit() } catch (_) {} })
      } else if (key === 'font_family') {
        term.options.fontFamily = value
      } else if (key === 'theme') {
        cachedTheme = value
        term.options.theme = value
      }
    })
    cleanups.push(onSetting)

    events.emit('pty:open', { ptyId, shell: shellInfo })
    return ptyId
  }

  /**
   * Write data to the PTY (keyboard input or programmatic).
   * @param {string} data
   */
  function write(data) {
    if (ptyId) invoke('write_pty', { ptyId, data }).catch(() => {})
  }

  /**
   * Resize the terminal.
   * @param {number} cols
   * @param {number} rows
   */
  function resize(cols, rows) {
    if (ptyId) invoke('resize_pty', { ptyId, cols, rows }).catch(() => {})
  }

  /**
   * Close the current PTY session and destroy xterm.
   */
  async function close() {
    if (ptyId) {
      try { await invoke('kill_pty', { ptyId }) } catch (_) {}
      ptyId = null
    }
    shell = null
    // Run all cleanups
    for (const fn of cleanups) { try { fn() } catch (_) {} }
    cleanups = []
    if (term) { term.dispose(); term = null }
    fit = null
    container = null
    resizeObserver = null
  }

  /**
   * Focus the terminal.
   */
  function focus() {
    if (term) term.focus()
  }

  /**
   * Get current terminal info.
   * @returns {{ ptyId: string|null, shell: object|null, cols: number, rows: number }}
   */
  function getInfo() {
    return {
      ptyId,
      shell,
      cols: term?.cols ?? 80,
      rows: term?.rows ?? 24,
    }
  }

  /**
   * Subscribe to user keyboard input.
   * @param {Function} fn - Callback(data: string)
   * @returns {Function} Unsubscribe
   */
  function onInput(fn) {
    inputHandlers.add(fn)
    return () => inputHandlers.delete(fn)
  }

  /**
   * Subscribe to PTY output data.
   * @param {Function} fn - Callback(data: string)
   * @returns {Function} Unsubscribe
   */
  function onData(fn) {
    dataHandlers.add(fn)
    return () => dataHandlers.delete(fn)
  }

  /**
   * Check if a terminal session is active.
   * @returns {boolean}
   */
  function isActive() {
    return ptyId !== null
  }

  return { open, write, resize, close, focus, getInfo, onInput, onData, isActive }
}

export const terminal = createTerminal()