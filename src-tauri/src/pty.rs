use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

static NEXT_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

fn next_id() -> String {
    let n = NEXT_ID.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    format!("pty{n}")
}

pub struct PtySession {
    _child: Box<dyn portable_pty::Child + Send + Sync>,
    _master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

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

pub fn spawn(
    state: &Arc<AppState>,
    app: &AppHandle,
    shell_path: &str,
    shell_args: &[String],
) -> Result<String, String> {
    let pty_system = state.pty_system.lock().unwrap();

    let pair = pty_system
        .openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| format!("openpty failed: {e}"))?;

    let mut cmd = CommandBuilder::new(shell_path);
    for arg in shell_args {
        cmd.arg(arg);
    }
    cmd.env("TERM", "xterm-direct");
    if let Ok(home) = std::env::var("HOME") {
        cmd.cwd(home);
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("spawn failed: {e}"))?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("reader clone failed: {e}"))?;
    let writer = pair.master.take_writer().map_err(|e| format!("take writer: {e}"))?;

    let pty_id = next_id();
    let ev_prefix = pty_id.clone();

    let session = PtySession { _child: child, _master: pair.master, writer };

    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(pty_id.clone(), session);
    }

    let app_c = app.clone();
    let pid_c = pty_id.clone();
    std::thread::spawn(move || {
        read_loop(reader, &app_c, &pid_c, &ev_prefix);
        let _ = app_c.emit(&format!("pty-exit-{ev_prefix}"), ());
    });

    Ok(pty_id)
}

fn read_loop(
    mut reader: Box<dyn Read + Send>,
    app: &AppHandle,
    _pty_id: &str,
    ev_prefix: &str,
) {
    let mut buf = [0u8; 4096];
    loop {
        let n = match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => n,
            Err(_) => break,
        };
        let data = String::from_utf8_lossy(&buf[..n]).to_string();
        if let Err(e) =
            app.emit(&format!("pty-output-{ev_prefix}"), serde_json::json!({ "data": data }))
        {
            eprintln!("emit error: {e}");
            break;
        }
    }
}

pub fn write(state: &AppState, pty_id: &str, data: &str) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions.get_mut(pty_id).ok_or_else(|| "PTY not found".to_string())?;
    session.writer.write_all(data.as_bytes()).map_err(|e| format!("write: {e}"))?;
    session.writer.flush().map_err(|e| format!("flush: {e}"))?;
    Ok(())
}

pub fn resize(state: &AppState, pty_id: &str, cols: u16, rows: u16) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions.get_mut(pty_id).ok_or_else(|| "PTY not found".to_string())?;
    session
        ._master
        .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| format!("resize: {e}"))?;
    Ok(())
}

pub fn kill(state: &AppState, pty_id: &str) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    sessions.remove(pty_id).ok_or_else(|| "PTY not found".to_string())?;
    Ok(())
}