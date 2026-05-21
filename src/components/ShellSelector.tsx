import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ShellInfo {
  name: string;
  path: string;
  icon: string;
  version: string;
  args: string[];
}

interface Props {
  onSelect: (shell: ShellInfo) => void;
  onSettings: () => void;
}

export default function ShellSelector({ onSelect, onSettings }: Props) {
  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<ShellInfo[]>("list_shells")
      .then(setShells)
      .catch((err: string) => setError(err));
  }, []);

  return (
    <div className="shell-selector">
      <div className="selector-header">
        <h1>Aether</h1>
        <button className="settings-gear" onClick={onSettings} title="Settings">
          ⚙
        </button>
      </div>
      <p className="subtitle">Choose a shell to launch</p>

      {error && <p style={{ color: "#e55", fontSize: 13 }}>{error}</p>}

      {shells.length === 0 && !error && (
        <p style={{ color: "#888", fontSize: 13 }}>Scanning for shells…</p>
      )}

      <div className="shell-grid">
        {shells.map((s) => (
          <div
            key={s.path}
            className="shell-card"
            onClick={() => onSelect(s)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSelect(s)}
          >
            <span className="icon">{s.icon}</span>
            <span className="name">{s.name}</span>
            <span className="version">{s.version}</span>
          </div>
        ))}
      </div>
    </div>
  );
}