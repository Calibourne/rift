use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Persistent application settings.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub font_family: String,
    pub font_size: u16,
    /// Default shell to auto-launch. Stored as JSON string of { name, path, args }.
    pub default_shell: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            font_family: "'JetBrains Mono', 'Fira Code', monospace".into(),
            font_size: 14,
            default_shell: None,
        }
    }
}

impl Settings {
    /// Path to the settings JSON file inside the app config directory.
    fn config_path(app: &AppHandle) -> PathBuf {
        let mut path = app
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        path.push("settings.json");
        path
    }

    /// Load settings from disk, or return defaults if the file doesn't exist
    /// or is corrupt.
    pub fn load(app: &AppHandle) -> Self {
        let path = Self::config_path(app);
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str(&content) {
                return settings;
            }
        }
        Self::default()
    }

    /// Save settings to disk, creating the directory if needed.
    pub fn save(&self, app: &AppHandle) -> Result<(), String> {
        let path = Self::config_path(app);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let content = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(&path, content).map_err(|e| e.to_string())?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Settings {
    Settings::load(&app)
}

#[tauri::command]
pub fn update_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    settings.save(&app)
}
