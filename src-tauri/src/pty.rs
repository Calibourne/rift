use anyhow::{Context, Result};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

/// A running PTY session.
pub struct PtySession {
    /// The child process handle (kept alive).
    _child: Box<dyn portable_pty::Child + Send + Sync>,
    /// The master PTY handle — kept alive for resize.
    _master: Box<dyn portable_pty::MasterPty + Send>,
    /// Write end — send keyboard input here.
    writer: Box<dyn Write + Send>,
}

/// Shared application state holding all active PTY sessions.
pub struct AppState {
    pub sessions: Mutex<HashMap<String, PtySession>>,
    pub pty_system: Mutex<Box<dyn PtySystem + Send>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            pty_system: Mutex::new(Box::new(NativePtySystem::default())),
        }
    }
}

// ---------------------------------------------------------------------------
// Spawn a shell inside a PTY
// ---------------------------------------------------------------------------

pub fn spawn(
    state: &Arc<AppState>,
    app: &AppHandle,
    shell_path: &str,
    shell_args: &[String],
) -> Result<String> {
    let pty_system = state.pty_system.lock().unwrap();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .context("failed to open PTY")?;

    // In portable-pty 0.8, PtyPair has .slave (ChildPty) and .master (MasterPty).
    let mut cmd = CommandBuilder::new(shell_path);
    for arg in shell_args {
        cmd.arg(arg);
    }
    cmd.env("TERM", "xterm-256color");
    if let Ok(home) = std::env::var("HOME") {
        cmd.cwd(home);
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .context("failed to spawn child process in PTY")?;

    let reader = pair
        .master
        .try_clone_reader()
        .context("failed to clone PTY reader")?;
    let writer = pair.master.take_writer()?;

    let pty_id = Uuid::new_v4().to_string();
    let event_prefix = pty_id.clone();

    let session = PtySession {
        _child: child,
        _master: pair.master,
        writer,
    };

    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(pty_id.clone(), session);
    }

    // Background read-loop: forward PTY output to the frontend.
    let app_clone = app.clone();
    let pid_clone = pty_id.clone();
    std::thread::spawn(move || {
        read_loop(reader, &app_clone, &pid_clone, &event_prefix);
        // On EOF / error, emit exit event.
        let _ = app_clone.emit(&format!("pty-exit-{event_prefix}"), ());
    });

    Ok(pty_id)
}

fn read_loop(
    mut reader: Box<dyn Read + Send>,
    app: &AppHandle,
    _pty_id: &str,
    event_prefix: &str,
) {
    let mut buf = [0u8; 4096];
    loop {
        let n = match reader.read(&mut buf) {
            Ok(0) => break, // EOF → child exited
            Ok(n) => n,
            Err(_) => break,
        };
        let data = String::from_utf8_lossy(&buf[..n]).to_string();
        if let Err(e) =
            app.emit(&format!("pty-output-{event_prefix}"), serde_json::json!({ "data": data }))
        {
            tracing::warn!("emit error: {e}");
            break;
        }
    }
}

// ---------------------------------------------------------------------------
// Write input to a PTY
// ---------------------------------------------------------------------------

pub fn write(state: &AppState, pty_id: &str, data: &str) -> Result<()> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions.get_mut(pty_id).context("PTY session not found")?;
    session.writer.write_all(data.as_bytes())?;
    session.writer.flush()?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Resize a PTY
// ---------------------------------------------------------------------------

pub fn resize(state: &AppState, pty_id: &str, cols: u16, rows: u16) -> Result<()> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions.get_mut(pty_id).context("PTY session not found")?;
    session._master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Kill a PTY session
// ---------------------------------------------------------------------------

pub fn kill(state: &AppState, pty_id: &str) -> Result<()> {
    let mut sessions = state.sessions.lock().unwrap();
    sessions.remove(pty_id).context("PTY session not found")?;
    // Dropping the session kills the child (ChildPty's Drop sends SIGHUP on Unix).
    Ok(())
}