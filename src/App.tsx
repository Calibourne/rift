import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import ShellSelector, { type ShellInfo } from "./components/ShellSelector";
import TerminalEmulator from "./components/Terminal";

type Phase = "select" | "terminal";

function App() {
  const [phase, setPhase] = useState<Phase>("select");
  const [activeShell, setActiveShell] = useState<ShellInfo | null>(null);
  const [ptyId, setPtyId] = useState<string | null>(null);

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

  return (
    <div className="app">
      {phase === "select" && <ShellSelector onSelect={handleSelect} />}
      {phase === "terminal" && activeShell && ptyId && (
        <TerminalEmulator
          ptyId={ptyId}
          shellName={activeShell.name}
          onClose={handleTerminalClose}
        />
      )}
    </div>
  );
}

export default App;