/**
 * @rift/catppuccin-theme
 *
 * Catppuccin Mocha color scheme.
 * Activate via command palette: "Theme: Catppuccin"
 */

const THEME = {
  name: 'catppuccin',
  colors: {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    selectionBackground: '#45475a',
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#f5c2e7',
    cyan: '#94e2d5',
    white: '#bac2de',
    brightBlack: '#585b70',
    brightRed: '#f38ba8',
    brightGreen: '#a6e3a1',
    brightYellow: '#f9e2af',
    brightBlue: '#89b4fa',
    brightMagenta: '#f5c2e7',
    brightCyan: '#94e2d5',
    brightWhite: '#a6adc8',
    /* chrome UI */
    chromeBg: '#11111b',
    chromeBorder: '#313244',
    cardBg: '#181825',
    cardHover: '#313244',
    textMuted: '#6c7086',
    textBright: '#cdd6f4',
    accent: '#89b4fa',
  },
}

function applyTerminalColors(rift) {
  const { colors } = THEME
  const theme = {
    background: colors.background,
    foreground: colors.foreground,
    cursor: colors.cursor,
    selectionBackground: colors.selectionBackground,
    black: colors.black, red: colors.red, green: colors.green, yellow: colors.yellow,
    blue: colors.blue, magenta: colors.magenta, cyan: colors.cyan, white: colors.white,
    brightBlack: colors.brightBlack, brightRed: colors.brightRed,
    brightGreen: colors.brightGreen, brightYellow: colors.brightYellow,
    brightBlue: colors.brightBlue, brightMagenta: colors.brightMagenta,
    brightCyan: colors.brightCyan, brightWhite: colors.brightWhite,
  }
  rift.events.emit('settings:changed', { key: 'theme', value: theme })
}

export function activate(rift) {
  rift.ui.registerTheme(THEME)

  rift.commands.register('rift:theme:catppuccin', {
    label: 'Theme: Catppuccin',
    category: 'Themes',
    handler: () => {
      rift.settings.set('theme_name', 'catppuccin')
      rift.ui.applyTheme('catppuccin')
      applyTerminalColors(rift)
    },
  })
}

export function deactivate() {}