import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FONT_OPTIONS } from "../fonts";

export interface AppSettings {
  font_family: string;
  font_size: number;
}

export type PartialAppSettings = Partial<AppSettings>;

interface Props {
  currentSettings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onBack: () => void;
}

export default function Settings({ currentSettings, onSave, onBack }: Props) {
  const [fontFamily, setFontFamily] = useState(currentSettings.font_family);
  const [fontSize, setFontSize] = useState(currentSettings.font_size);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFontFamily(currentSettings.font_family);
    setFontSize(currentSettings.font_size);
  }, [currentSettings]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    const newSettings: AppSettings = { font_family: fontFamily, font_size: fontSize };
    try {
      await invoke("update_settings", { settings: newSettings });
      onSave(newSettings);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [fontFamily, fontSize, onSave]);

  // The selected font's label for the preview text
  const previewStyle: React.CSSProperties = {
    fontFamily,
    fontSize,
    lineHeight: 1.5,
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h1>Settings</h1>
      </div>

      <div className="settings-body">
        {/* Font family */}
        <label className="setting-row">
          <span className="setting-label">Terminal font</span>
          <select
            className="font-picker"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        {/* Font size */}
        <label className="setting-row">
          <span className="setting-label">Font size</span>
          <div className="size-control">
            <input
              type="range"
              min={10}
              max={24}
              step={1}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
            <span className="size-value">{fontSize}px</span>
          </div>
        </label>

        {/* Preview */}
        <div className="preview-box" style={previewStyle}>
          <div className="preview-header">Preview</div>
          <div>
            <span style={{ color: "#e57373" }}>λ</span>{" "}
            <span style={{ color: "#81c784" }}>~</span>{" "}
            <span style={{ color: "#64b5f6" }}>echo</span>{" "}
            <span style={{ color: "#ffd54f" }}>"hello from nf"</span>
          </div>
          <div style={{ color: "#888" }}>
            ➜ ~ ls -la
          </div>
          <div style={{ color: "#888", fontSize: fontSize - 2 }}>
            ───────────────── /home/user ─
          </div>
        </div>

        {error && <p className="settings-error">{error}</p>}

        <button
          className="save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}