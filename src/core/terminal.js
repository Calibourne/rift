/**
 * Rift Terminal Manager — Multi-Session
 *
 * Manages N terminal sessions in a Map. Each session has its own
 * xterm.js instance, PTY connection, and child <div> in the DOM.
 * Only the active session's <div> is visible.
 *
 * API (all methods auto-target active session when id omitted):
 *   create(shellInfo, options?) -> sessionId
 *   createAndOpen(container, shellInfo, options?) -> sessionId
 *   switch(id)
 *   close(id?)
 *   list() -> string[]
 *   focus()
 *   write(data, id?)
 *   resize(cols, rows, id?)
 *   getInfo(id?) -> { ptyId, shell, cols, rows, title }
 *   getSelection() -> string|null
 *   isActive() -> boolean
 *   activeId -> string|null    (getter)
 *   onInput(fn) -> unsub
 *   onData(fn) -> unsub
 *   onTitleChange(fn) -> unsub
 */

import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { events } from './event-bus.js'
import { keybindings } from './keybindings.js'

function createTerminal() {
  /** @type {Map<string, object>} */
  const sessions = new Map()

  /** @type {string | null} */
  let _activeId = null

  /** @type {HTMLElement | null} */
  let parentContainer = null

  /** @type {Set<Function>} */
  const inputHandlers = new Set()
  /** @type {Set<Function>} */
  const dataHandlers = new Set()
  /** @type {Set<Function>} */
  const titleHandlers = new Set()

  /** @type {object | null} */
  let cachedTheme = null

  /** @type {ResizeObserver | null} */
  let resizeObserver = null
  /** @type {number | null} */
  let resizeTimer = null

  function getActive() {
    return _activeId ? sessions.get(_activeId) : null
  }

  /**
   * Create a new session (spawn PTY, init xterm) in a hidden <div> child.
   * Does NOT switch to it.
   * @param {object} shellInfo - { name, path, args }
   * @param {object} [options] - xterm options overrides
   * @returns {Promise<string>} sessionId
   */
  async function create(shellInfo, options = {}) {
    const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)

    // Spawn PTY
    const ptyId = await invoke('launch_shell', {
      shellPath: shellInfo.path,
      shellArgs: shellInfo.args,
    })

    // Create child <div> (hidden)
    const div = document.createElement('div')
    div.style.display = 'none'
    div.style.width = '100%'
    div.style.height = '100%'
    div.style.position = 'absolute'
    div.style.top = '0'
    div.style.left = '0'

    // Append to parent container (if set)
    if (parentContainer) {
      parentContainer.appendChild(div)
    }

    // Init xterm
    const fit = new FitAddon()
    const scrollback = options.scrollback ?? 5000
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: "'JetBrainsMono Nerd Font','JetBrains Mono','Fira Code',monospace",
      scrollback,
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
      attachCustomKeyEventHandler: (e) => {
        if (keybindings.isRegistered(e)) return false
        return true
      },
      ...options,
    })
    term.loadAddon(fit)
    term.open(div)

    const cleanups = []

    // ── Tauri event listeners ──
    const unOut = await listen(`pty-output-${ptyId}`, ev => {
      const data = ev.payload.data
      if (term) term.write(data)
      for (const fn of dataHandlers) { try { fn(data) } catch (_) {} }
    })
    cleanups.push(unOut)

    const unExit = await listen(`pty-exit-${ptyId}`, () => {
      if (term) term.write('\r\n\x1b[31m[process exited]\x1b[0m\r\n')
      events.emit('pty:exit', { ptyId, sessionId: id })

      // Auto-close after 1.5s if still active
      setTimeout(() => {
        const sess = sessions.get(id)
        if (!sess) return
        close(id)
      }, 1500)
    })
    cleanups.push(unExit)

    // ── Input forwarding ──
    const disposable = term.onData(data => {
      invoke('write_pty', { ptyId, data }).catch(() => {})
      for (const fn of inputHandlers) { try { fn(data) } catch (_) {} }
    })
    cleanups.push(() => disposable.dispose())

    // ── Module-level resize: single observer for active session ──
    if (parentContainer && !resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        const sess = getActive()
        if (!sess || !sess.fit || !sess.term) return
        try { sess.fit.fit() } catch { return }
        invoke('resize_pty', { ptyId: sess.ptyId, cols: sess.term.cols, rows: sess.term.rows })
          .catch(() => {})
      })
      resizeObserver.observe(parentContainer)

      const onWinResize = () => {
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          const sess = getActive()
          if (!sess || !sess.fit || !sess.term) return
          try { sess.fit.fit() } catch { return }
          invoke('resize_pty', { ptyId: sess.ptyId, cols: sess.term.cols, rows: sess.term.rows })
            .catch(() => {})
        }, 60)
      }
      window.addEventListener('resize', onWinResize)
    }

    // ── OSC title tracking ──
    const titleDispose = term.onTitleChange(t => {
      events.emit('session:title-changed', { id, title: t })
      for (const fn of titleHandlers) { try { fn(t) } catch (_) {} }
    })
    cleanups.push(() => titleDispose.dispose())

    const session = {
      id, ptyId, shell: shellInfo,
      term, fit, container: div, cleanups,
      title: '',
      options: { ...options },
    }

    sessions.set(id, session)
    events.emit('session:created', { id, shell: shellInfo })

    // React to settings:changed (fonts, themes — apply to ALL sessions)
    const onSetting = events.on('settings:changed', ({ key, value }) => {
      // Apply to all existing sessions
      for (const [, s] of sessions) {
        if (!s.term) continue
        if (key === 'font_size') {
          s.term.options.fontSize = value
          if (_activeId === s.id) {
            requestAnimationFrame(() => { try { s.fit?.fit() } catch {} })
          }
        } else if (key === 'font_family') {
          s.term.options.fontFamily = value
        } else if (key === 'theme') {
          cachedTheme = value
          s.term.options.theme = value
        }
      }
    })
    cleanups.push(onSetting)

    return id
  }

  /**
   * Create a new session and immediately switch to it.
   * Equivalent to old terminal.open().
   * @param {HTMLElement} container - parent DOM element
   * @param {object} shellInfo
   * @param {object} [options]
   * @returns {Promise<string>} sessionId
   */
  async function createAndOpen(container, shellInfo, options = {}) {
    parentContainer = container
    const id = await create(shellInfo, options)
    if (id) switch_(id)
    return id
  }

  /**
   * Switch to a different session.
   * @param {string} id
   */
  function switch_(id) {
    if (id === _activeId) return
    const old = getActive()
    if (old && old.container) {
      old.container.style.display = 'none'
    }

    const sess = sessions.get(id)
    if (!sess) return

    _activeId = id
    sess.container.style.display = ''

    // Fit after layout settles
    requestAnimationFrame(() => {
      try { sess.fit.fit() } catch {}
    })

    events.emit('session:switched', { id })
  }

  /**
   * Close a session. If no id, close active. If it was the active
   * session and more exist, auto-switch to the next.
   * @param {string} [id]
   */
  async function close(id) {
    if (!id && !_activeId) return
    if (!id) id = _activeId
    const sess = sessions.get(id)
    if (!sess) return

    // Run cleanups
    for (const fn of sess.cleanups) { try { fn() } catch {} }

    // Kill PTY
    try { await invoke('kill_pty', { ptyId: sess.ptyId }) } catch {}

    // Destroy xterm
    if (sess.term) sess.term.dispose()
    if (sess.container && sess.container.parentNode) {
      sess.container.parentNode.removeChild(sess.container)
    }

    sessions.delete(id)
    events.emit('session:closed', { id })

    // If it was the active session, switch to next or null
    if (_activeId === id) {
      _activeId = null
      if (sessions.size > 0) {
        const next = sessions.keys().next().value
        switch_(next)
      } else {
        events.emit('session:closed-last', {})
      }
    }
  }

  /**
   * List all session IDs.
   * @returns {string[]}
   */
  function list() {
    return [...sessions.keys()]
  }

  /**
   * Focus the active terminal.
   */
  function focus() {
    const sess = getActive()
    if (sess && sess.term) sess.term.focus()
  }

  /**
   * Write data to a session's PTY.
   * @param {string} data
   * @param {string} [id] - defaults to active session
   */
  function write(data, id) {
    const sess = id ? sessions.get(id) : getActive()
    if (sess && sess.ptyId) {
      invoke('write_pty', { ptyId: sess.ptyId, data }).catch(() => {})
    }
  }

  /**
   * Resize a session.
   * @param {number} cols
   * @param {number} rows
   * @param {string} [id]
   */
  function resize(cols, rows, id) {
    const sess = id ? sessions.get(id) : getActive()
    if (sess && sess.ptyId) {
      invoke('resize_pty', { ptyId: sess.ptyId, cols, rows }).catch(() => {})
    }
  }

  /**
   * Get info for a session.
   * @param {string} [id]
   * @returns {{ ptyId: string|null, shell: object|null, cols: number, rows: number, title: string }}
   */
  function getInfo(id) {
    const sess = id ? sessions.get(id) : getActive()
    if (!sess) return { ptyId: null, shell: null, cols: 80, rows: 24, title: '' }
    return {
      ptyId: sess.ptyId,
      shell: sess.shell,
      cols: sess.term?.cols ?? 80,
      rows: sess.term?.rows ?? 24,
      title: sess.title,
    }
  }

  /**
   * Get selected text from active terminal.
   * @returns {string|null}
   */
  function getSelection() {
    const sess = getActive()
    if (sess && sess.term) {
      return sess.term.getSelection()
    }
    return null
  }

  /**
   * Check if any sessions exist.
   * @returns {boolean}
   */
  function isActive() {
    return sessions.size > 0
  }

  /**
   * Subscribe to user keyboard input from active session.
   * @param {Function} fn
   * @returns {Function} unsub
   */
  function onInput(fn) {
    inputHandlers.add(fn)
    return () => inputHandlers.delete(fn)
  }

  /**
   * Subscribe to PTY output from active session.
   * @param {Function} fn
   * @returns {Function} unsub
   */
  function onData(fn) {
    dataHandlers.add(fn)
    return () => dataHandlers.delete(fn)
  }

  /**
   * Subscribe to OSC title changes from any session.
   * @param {Function} fn - Callback(title: string)
   * @returns {Function} unsub
   */
  function onTitleChange(fn) {
    titleHandlers.add(fn)
    return () => titleHandlers.delete(fn)
  }

  return {
    create,
    createAndOpen,
    switch: switch_,
    close,
    list,
    focus,
    write,
    resize,
    getInfo,
    getSelection,
    isActive,
    get activeId() { return _activeId },
    onInput,
    onData,
    onTitleChange,
  }
}

export const terminal = createTerminal()