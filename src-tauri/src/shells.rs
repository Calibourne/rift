use serde::Serialize;
use std::char::decode_utf16;

/// Information about a detected shell.
#[derive(Debug, Clone, Serialize)]
pub struct ShellInfo {
    pub name: String,
    pub path: String,
    pub icon: String,
    pub version: String,
    pub args: Vec<String>,
}

// ---------------------------------------------------------------------------
// Unix shell detection
// ---------------------------------------------------------------------------

#[cfg(not(target_os = "windows"))]
pub fn detect_shells() -> Vec<ShellInfo> {
    let default_shell = std::env::var("SHELL").ok();

    let mut shells: Vec<ShellInfo> = Vec::new();

    // Check well-known shell paths.
    for (name, path, icon, args) in SHELL_CANDIDATES_UNIX {
        let p = PathBuf::from(path);
        if p.exists() {
            let version = probe_version(path);
            let mut info = ShellInfo {
                name: name.to_string(),
                path: path.to_string(),
                icon: icon.to_string(),
                version,
                args: args.iter().map(|s| s.to_string()).collect(),
            };

            // Mark the user's default shell.
            if let Some(def) = &default_shell {
                if def.as_str() == *path {
                    info.name.push_str(" (default)");
                }
            }

            shells.push(info);
        }
    }

    // Also scan /etc/shells for anything extra.
    if let Ok(content) = std::fs::read_to_string("/etc/shells") {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let p = PathBuf::from(line);
            if p.exists() && !shells.iter().any(|s| s.path == line) {
                let name = p
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                let version = probe_version(line);
                shells.push(ShellInfo {
                    name,
                    path: line.to_string(),
                    icon: "\u{1f4e6}".to_string(), // generic package icon
                    version,
                    args: vec![],
                });
            }
        }
    }

    shells
}

#[cfg(not(target_os = "windows"))]
const SHELL_CANDIDATES_UNIX: &[(&str, &str, &str, &[&str])] = &[
    ("bash", "/bin/bash", "\u{1f4e6}", &["--login"]),
    ("zsh", "/bin/zsh", "\u{1f4e6}", &["--login"]),
    ("fish", "/usr/bin/fish", "\u{1f4e6}", &["--login"]),
    ("sh", "/bin/sh", "\u{1f4e6}", &[]),
    ("bash", "/usr/bin/bash", "\u{1f4e6}", &["--login"]),
    ("zsh", "/usr/bin/zsh", "\u{1f4e6}", &["--login"]),
];

// ---------------------------------------------------------------------------
// Windows shell detection
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
pub fn detect_shells() -> Vec<ShellInfo> {
    let mut shells: Vec<ShellInfo> = Vec::new();

    // PowerShell 7 (pwsh.exe) — check PATH first.
    if let Some(p) = which_in_path("pwsh.exe") {
        shells.push(ShellInfo {
            name: "PowerShell 7".into(),
            path: p.clone(),
            icon: "\u{1f4e6}".into(),
            version: probe_version(&p),
            args: vec![],
        });
    }

    // Windows PowerShell (powershell.exe).
    let ps_path = std::path::Path::new(r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe");
    if ps_path.exists() {
        shells.push(ShellInfo {
            name: "Windows PowerShell".into(),
            path: ps_path.to_string_lossy().into(),
            icon: "\u{1f4e6}".into(),
            version: String::new(),
            args: vec![],
        });
    }

    // CMD.
    let cmd_path = std::path::Path::new(r"C:\Windows\System32\cmd.exe");
    if cmd_path.exists() {
        shells.push(ShellInfo {
            name: "Command Prompt".into(),
            path: cmd_path.to_string_lossy().into(),
            icon: "\u{1f4e6}".into(),
            version: String::new(),
            args: vec!["/K".into()],
        });
    }

    // Git Bash — common install paths.
    for candidate in &[
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files (x86)\Git\bin\bash.exe",
    ] {
        let p = std::path::Path::new(candidate);
        if p.exists() {
            shells.push(ShellInfo {
                name: "Git Bash".into(),
                path: candidate.to_string(),
                icon: "\u{1f4e6}".into(),
                version: probe_version(candidate),
                args: vec!["--login".into(), "-i".into()],
            });
            break;
        }
    }

    // WSL distros.
    detect_wsl_distros(&mut shells);

    shells
}

#[cfg(target_os = "windows")]
fn detect_wsl_distros(shells: &mut Vec<ShellInfo>) {
    // Attempt to list WSL distros.
    let output = std::process::Command::new("wsl.exe")
        .args(["--list", "--quiet"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            // wsl.exe outputs UTF-16LE — decode properly.
            let stdout = decode_utf16le(&out.stdout);
            for line in stdout.lines() {
                let distro = line.trim();
                if distro.is_empty()
                    || distro.eq_ignore_ascii_case("docker-desktop")
                    || distro.eq_ignore_ascii_case("docker-desktop-data")
                {
                    continue;
                }

                let name = format!("WSL: {distro}");

                // Let WSL launch the distro's own default login shell.
                // WSL always starts as a login shell — no need to probe
                // for a specific shell path or pass --login ourselves.
                let args: Vec<String> = vec![
                    "~".into(),          // start in WSL home
                    "-d".into(),          // target this distro
                    distro.to_string(),
                ];

                shells.push(ShellInfo {
                    name,
                    path: "wsl.exe".into(),
                    icon: "\u{1f4e6}".into(),
                    version: distro.to_string(),
                    args,
                });
            }
        }
        Ok(_) => {
            // wsl.exe exists but listing failed (no distros).
        }
        Err(_) => {
            // wsl.exe not found.
        }
    }
}

#[cfg(target_os = "windows")]
fn which_in_path(name: &str) -> Option<String> {
    let path = std::env::var("PATH").unwrap_or_default();
    for dir in std::env::split_paths(&path) {
        let candidate = dir.join(name);
        if candidate.exists() {
            return Some(candidate.to_string_lossy().into());
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/// Decode a UTF-16LE byte buffer into a `String`, replacing ill-formed sequences
/// with U+FFFD.  This is needed because `wsl.exe --list --quiet` outputs UTF‑16LE.
fn decode_utf16le(bytes: &[u8]) -> String {
    let u16s: Vec<u16> = bytes
        .chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .collect();
    decode_utf16(u16s.into_iter().map(|c| c))
        .map(|r| r.unwrap_or(char::REPLACEMENT_CHARACTER))
        .collect()
}

/// Run `<shell> --version` and return stdout (first two lines).
fn probe_version(path: &str) -> String {
    let output = match std::process::Command::new(path).arg("--version").output() {
        Ok(o) => o,
        Err(_) => return String::new(),
    };
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{stdout}{stderr}");
    let mut lines: Vec<&str> = combined.lines().collect();
    lines.truncate(2);
    let v = lines.join(" ");
    if v.len() > 80 { v[..77].to_string() + "..." } else { v }
}