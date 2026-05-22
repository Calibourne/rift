/**
 * @aether/default-theme
 *
 * Registers the default dark theme and applies it on boot.
 * Can be overridden by a user plugin named "default-theme".
 */

const THEME = {
  name: 'aether-dark',
  colors: {
    background: '#0e0e1a',
    foreground: '#d0d0d0',
    cursor: '#e0e0e0',
    selectionBackground: '#334',
    black: '#1a1a2e',
    red: '#e57373',
    green: '#81c784',
    yellow: '#ffd54f',
    blue: '#64b5f6',
    magenta: '#ce93d8',
    cyan: '#4dd0e1',
    white: '#d0d0d0',
    brightBlack: '#444',
    brightRed: '#ef9a9a',
    brightGreen: '#a5d6a7',
    brightYellow: '#fff176',
    brightBlue: '#90caf9',
    brightMagenta: '#e1bee7',
    brightCyan: '#80deea',
    brightWhite: '#f5f5f5',
    // CSS custom properties for the UI chrome
    chromeBg: '#12121e',
    chromeBorder: '#2a2a3e',
    cardBg: '#16162a',
    cardHover: '#1e1e3a',
    textMuted: '#888',
    textBright: '#f0f0f0',
    accent: '#64b5f6',
  },
}

export function activate(aether) {
  aether.ui.registerTheme(THEME)
  aether.ui.applyTheme('aether-dark')
}

export function deactivate() {
  // No cleanup needed — themes are passive data
}