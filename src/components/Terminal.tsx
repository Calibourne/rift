import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface Props {
  ptyId: string;
  shellName: string;
  fontFamily: string;
  fontSize: number;
  onClose: () => void;
}

export default function TerminalEmulator({
  ptyId,
  shellName,
  fontFamily,
  fontSize,
  onClose,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef(ptyId);

  // keep ref in sync
  useEffect(() => {
    ptyIdRef.current = ptyId;
  }, [ptyId]);

  // --- lifecycle: create / destroy xterm ---
  useEffect(() => {
    const fitAddon = new FitAddon();
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize,
      fontFamily,
      theme: {
        background: "#0e0e1a",
        foreground: "#d0d0d0",
        cursor: "#e0e0e0",
        selectionBackground: "#334",
        black: "#1a1a2e",
        red: "#e57373",
        green: "#81c784",
        yellow: "#ffd54f",
        blue: "#64b5f6",
        magenta: "#ce93d8",
        cyan: "#4dd0e1",
        white: "#d0d0d0",
        brightBlack: "#444",
        brightRed: "#ef9a9a",
        brightGreen: "#a5d6a7",
        brightYellow: "#fff176",
        brightBlue: "#90caf9",
        brightMagenta: "#e1bee7",
        brightCyan: "#80deea",
        brightWhite: "#f5f5f5",
      },
      allowTransparency: false,
      cols: 80,
      rows: 24,
    });

    term.loadAddon(fitAddon);
    termRef.current = term;
    fitRef.current = fitAddon;

    // attach to DOM
    if (containerRef.current) {
      term.open(containerRef.current);
      // small delay so layout settles
      requestAnimationFrame(() => fitAddon.fit());
    }

    // --- event listeners from Rust ---

    let unlistenOutput: UnlistenFn | undefined;
    let unlistenExit: UnlistenFn | undefined;

    (async () => {
      unlistenOutput = await listen<{ data: string }>(
        `pty-output-${ptyId}`,
        (event) => {
          term.write(event.payload.data);
        },
      );

      unlistenExit = await listen(`pty-exit-${ptyId}`, () => {
        term.write("\r\n\x1b[31m[process exited]\x1b[0m\r\n");
        setTimeout(onClose, 1500);
      });
    })();

    // --- input forwarding ---
    const disposable = term.onData((data) => {
      invoke("write_pty", { ptyId, data }).catch(console.error);
    });

    // --- resize handling ---
    const onResize = () => {
      try {
        fitAddon.fit();
      } catch {
        return;
      }
      invoke("resize_pty", {
        ptyId,
        cols: term.cols,
        rows: term.rows,
      }).catch(console.error);
    };

    const resizeObserver = new ResizeObserver(() => onResize());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // --- cleanup ---
    return () => {
      disposable.dispose();
      resizeObserver.disconnect();
      if (unlistenOutput) unlistenOutput();
      if (unlistenExit) unlistenExit();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [ptyId, onClose]);

  // --- sync font / size changes to live terminal ---
  useEffect(() => {
    const term = termRef.current;
    if (term) {
      term.options.fontFamily = fontFamily;
    }
  }, [fontFamily]);

  useEffect(() => {
    const term = termRef.current;
    const fit = fitRef.current;
    if (term && fit) {
      term.options.fontSize = fontSize;
      // re-fit after size change so layout adjusts
      requestAnimationFrame(() => {
        try {
          fit.fit();
        } catch {
          /* ignore */
        }
      });
    }
  }, [fontSize]);

  // --- re-fit when the container changes size (window resize, etc.) ---
  const fitTerm = useCallback(() => {
    const fit = fitRef.current;
    const term = termRef.current;
    if (!fit || !term) return;
    try {
      fit.fit();
    } catch {
      return;
    }
    invoke("resize_pty", {
      ptyId,
      cols: term.cols,
      rows: term.rows,
    }).catch(console.error);
  }, [ptyId]);

  // debounced resize on window resize
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(fitTerm, 60);
    };
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("resize", handler);
      clearTimeout(timer);
    };
  }, [fitTerm]);

  return (
    <>
      <div className="terminal-toolbar">
        <div className="tab">
          <span>{shellName}</span>
        </div>
        <button className="close-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="terminal-container" ref={containerRef} />
    </>
  );
}