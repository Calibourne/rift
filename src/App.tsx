import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import ShellSelector, { type ShellInfo } from "./components/ShellSelector";
import TerminalEmulator from "./components/Terminal";
import Settings, { type AppSettings } from "./components/Settings";
import type { PartialAppSettings } from "./components/Settings";

type Phase = "select" | "terminal" | "settings";

const DEFAULT_SETTINGS: AppSettings = {
  font_family: "'JetBrainsMono Nerd Font', 'JetBrains Mono', 'Fira Code', monospace",
  font_size: 14,
};

function App() {
  const [phase, setPhase] = useState<Phase>("select");
  const [activeShell, setActiveShell] = useState<ShellInfo | null>(null);
  const [ptyId, setPtyId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Load persisted settings on startup
  useEffect(() => {
    invoke<AppSettings>("get_settings")
      .then(setSettings)
      .catch(() => {
        // defaults are fine
      });
  }, []);

  const handleSelect = useCallback(async (shell: ShellInfo) => {
    try {
      const id: string = await invoke("launch_shell", {
        shellPath: shell.path,
        shellArgs: shell.args,
      });
      setActiveShell(shell);
      setPtyId(id);
      setPhase("terminal");
    } catch (err) {
      console.error("Failed to launch shell:", err);
    }
  }, []);

  const handleTerminalClose = useCallback(() => {
    if (ptyId) {
      invoke("kill_pty", { ptyId }).catch(console.error);
    }
    setPtyId(null);
    setActiveShell(null);
    setPhase("select");
  }, [ptyId]);

  const handleOpenSettings = useCallback(() => {
    setPhase("settings");
  }, []);

  const handleSaveSettings = useCallback((s: AppSettings) => {
    setSettings(s);
    setPhase("select");
  }, []);

  const handleBackFromSettings = useCallback(() => {
    setPhase("select");
  }, []);

  const handleSettingsChange = useCallback((patch: PartialAppSettings) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      // persist immediately
      invoke("update_settings", { settings: next }).catch(console.error);
      return next;
    });
  }, []);

  return (
    <div className="app">
      {phase === "select" && (
        <ShellSelector
          onSelect={handleSelect}
          onSettings={handleOpenSettings}
        />
      )}
      {phase === "terminal" && activeShell && ptyId && (
        <TerminalEmulator
          ptyId={ptyId}
          shellName={activeShell.name}
          fontFamily={settings.font_family}
          fontSize={settings.font_size}
          onClose={handleTerminalClose}
          onSettingsChange={handleSettingsChange}
        />
      )}
      {phase === "settings" && (
        <Settings
          currentSettings={settings}
          onSave={handleSaveSettings}
          onBack={handleBackFromSettings}
        />
      )}
    </div>
  );
}

export default App;