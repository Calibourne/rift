use crate::pty::AppState;
use crate::shells;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

/// Discover available shells on the current platform.
#[tauri::command]
fn list_shells() -> Vec<shells::ShellInfo> {
    shells::detect_shells()
}

/// Launch a shell in a new PTY session.
#[tauri::command]
fn launch_shell(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    shell_path: String,
    shell_args: Vec<String>,
) -> Result<String, String> {
    crate::pty::spawn(state.inner(), &app, &shell_path, &shell_args).map_err(|e| e.to_string())
}

/// Write input data to a running PTY session.
#[tauri::command]
fn write_pty(state: State<'_, Arc<AppState>>, pty_id: String, data: String) -> Result<(), String> {
    crate::pty::write(state.inner(), &pty_id, &data).map_err(|e| e.to_string())
}

/// Resize a running PTY session.
#[tauri::command]
fn resize_pty(
    state: State<'_, Arc<AppState>>,
    pty_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    crate::pty::resize(state.inner(), &pty_id, cols, rows).map_err(|e| e.to_string())
}

/// Kill and remove a PTY session.
#[tauri::command]
fn kill_pty(state: State<'_, Arc<AppState>>, pty_id: String) -> Result<(), String> {
    crate::pty::kill(state.inner(), &pty_id).map_err(|e| e.to_string())
}