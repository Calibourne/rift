# Aether

Minimal, extensible Tauri-based terminal runtime focused on clean cross-platform
PTY management and environment-aware shell launching.

## Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (React + xterm.js)            │
│  - Shell selection grid                 │
│  - Terminal renderer                    │
│  - I/O via Tauri events / invoke        │
└──────────────┬──────────────────────────┘
               │  IPC (invoke / events)
┌──────────────▼──────────────────────────┐
│  Rust Backend (Tauri)                   │
│  - pty.rs   PTY lifecycle & I/O         │
│  - shells.rs Cross-platform detection   │
│  - commands.rs Tauri command handlers   │
└─────────────────────────────────────────┘
```

**v0 does not include:** AI features, plugins, session management,
workflows, panes, tabs, or any abstractions beyond what's listed above.

## Prerequisites

| Tool        | Version      |
|-------------|-------------|
| Rust        | 1.75+       |
| Node.js     | 20+         |
| npm         | 10+         |

### System libraries (Linux)

```bash
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev \
  libsoup-3.0-dev \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

On **macOS** no extra libraries are needed.
On **Windows** install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
and [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (included in Windows 11).

## Getting started

```bash
# Install JS dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Shell detection

| Platform  | Detected shells                                   |
|-----------|---------------------------------------------------|
| Linux     | bash, zsh, fish, sh (from /etc/shells or /usr/bin)|
| macOS     | bash, zsh, fish, sh                               |
| Windows   | PowerShell 7, Windows PowerShell, CMD, Git Bash   |
| Windows   | Each WSL distro (via `wsl --list --quiet`)        |

## Project structure

```
aether/
├── src/                         # Frontend (React + xterm.js)
│   ├── main.tsx                 # Entry point
│   ├── App.tsx                  # App shell (selector → terminal)
│   ├── App.css                  # All styles
│   └── components/
│       ├── ShellSelector.tsx    # Shell grid picker
│       └── Terminal.tsx         # xterm.js wrapper + I/O bridge
├── src-tauri/                   # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs              # Entry point
│       ├── lib.rs               # Tauri app setup / plugin registration
│       ├── shells.rs            # Shell detection (Unix / Windows)
│       ├── pty.rs               # PTY session management
│       └── commands.rs          # Tauri IPC command handlers
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## IPC surface

### Commands (frontend → backend)

| Command        | Args                                    | Returns        |
|----------------|-----------------------------------------|----------------|
| `list_shells`  | —                                       | `ShellInfo[]`  |
| `launch_shell` | `shell_path`, `shell_args`              | `pty_id`       |
| `write_pty`    | `pty_id`, `data`                        | —              |
| `resize_pty`   | `pty_id`, `cols`, `rows`                | —              |
| `kill_pty`     | `pty_id`                                | —              |

### Events (backend → frontend)

| Event pattern         | Payload           | Fires when                     |
|-----------------------|-------------------|--------------------------------|
| `pty-output-{id}`     | `{ data: string }`| PTY produces stdout            |
| `pty-exit-{id}`       | `{}`              | PTY child process exits        |

## License

MIT
