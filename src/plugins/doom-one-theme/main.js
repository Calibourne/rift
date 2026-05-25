/**
 * @rift/doom-one-theme
 *
 * Doom Emacs' doom-one color scheme.
 * Activate via command palette: "Theme: Doom One"
 */

const THEME = {
  name: 'doom-one',
  colors: {
    background: '#282c34',
    foreground: '#bbc2cf',
    cursor: '#51afef',
    selectionBackground: '#3e4452',
    black: '#282c34',
    red: '#ff6c6b',
    green: '#98be65',
    yellow: '#ECBE7B',
    blue: '#51afef',
    magenta: '#c678dd',
    cyan: '#46bdd0',
    white: '#bbc2cf',
    brightBlack: '#5B6268',
    brightRed: '#ff6c6b',
    brightGreen: '#98be65',
    brightYellow: '#ECBE7B',
    brightBlue: '#51afef',
    brightMagenta: '#c678dd',
    brightCyan: '#46bdd0',
    brightWhite: '#eff1f5',
    /* chrome UI */
    chromeBg: '#21242b',
    chromeBorder: '#3e4452',
    cardBg: '#2c323c',
    cardHover: '#353b45',
    textMuted: '#5B6268',
    textBright: '#eff1f5',
    accent: '#51afef',
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

  rift.commands.register('rift:theme:doom-one', {
    label: 'Theme: Doom One',
    category: 'Themes',
    handler: () => {
      rift.settings.set('theme_name', 'doom-one')
      rift.ui.applyTheme('doom-one')
      applyTerminalColors(rift)
    },
  })
}

export function deactivate() {}