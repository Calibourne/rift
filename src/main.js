import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./style.css";

/* ── font catalogue ── */

const FONTS = [
  { l:"JetBrains Mono",          v:"'JetBrainsMono Nerd Font','JetBrains Mono','Fira Code',monospace" },
  { l:"Fira Code",               v:"'FiraCode Nerd Font','Fira Code','JetBrains Mono',monospace" },
  { l:"Cascadia Code",           v:"'Cascadia Code','Cascadia Mono','CaskaydiaCove Nerd Font',monospace" },
  { l:"Meslo",                   v:"'MesloLGS Nerd Font','Meslo LG S','Menlo',monospace" },
  { l:"Hack",                    v:"'Hack Nerd Font',Hack,'Courier New',monospace" },
  { l:"Victor Mono",            v:"'VictorMono Nerd Font','Victor Mono','JetBrains Mono',monospace" },
  { l:"Iosevka",                v:"'Iosevka Nerd Font',Iosevka,monospace" },
  { l:"Source Code Pro",        v:"'SauceCodePro Nerd Font','Source Code Pro',monospace" },
  { l:"Ubuntu Mono",            v:"'UbuntuMono Nerd Font','Ubuntu Mono',monospace" },
  { l:"DejaVu Sans Mono",       v:"'DejaVuSansMono Nerd Font','DejaVu Sans Mono',monospace" },
  { l:"Menlo",                  v:"Menlo,Monaco,'Courier New',monospace" },
  { l:"Consolas",               v:"Consolas,'Courier New',monospace" },
  { l:"Inconsolata",            v:"Inconsolata,'DejaVu Sans Mono',monospace" },
  { l:"Courier New",            v:"'Courier New',monospace" },
];

const DEFAULT = {
  font_family: "'JetBrainsMono Nerd Font','JetBrains Mono','Fira Code',monospace",
  font_size: 14,
};

/* ── state ── */

let phase = "select";     // select | terminal | settings
let activeShell = null;
let ptyId = null;
let settings = { ...DEFAULT };
let term = null;          // xterm Terminal instance
let fit = null;           // FitAddon instance
let termContainer = null; // DOM ref to terminal container div

/* ── helpers ── */

const $ = (s,p=document) => p.querySelector(s);
const $$ = (s,p=document) => [...p.querySelectorAll(s)];
const h = (tag,attrs={},...kids) => {
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs))
    if (k==="className") e.className=v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(),v);
    else if (k==="style" && typeof v==="object") Object.assign(e.style,v);
    else e.setAttribute(k,v);
  for (const c of kids) e.append(c);
  return e;
};
const txt = (s) => document.createTextNode(s);

/* ── render shell selector ── */

function renderSelect() {
  const root = document.getElementById("root");
  root.innerHTML = "";

  const header = h("div",{className:"selector-header"},
    h("h1",{},txt("Aether")),
    h("button",{className:"settings-gear",onClick:()=>{ phase="settings"; render(); }},txt("\u2699"))
  );
  const sub = h("p",{className:"subtitle"},txt("Choose a shell to launch"));

  invoke("list_shells").then(shells => {
    const grid = $(".shell-grid",root);
    if (!grid) return;
    grid.innerHTML = "";
    for (const s of shells) {
      const card = h("div",{className:"shell-card",role:"button",tabIndex:"0",
        onClick:()=>launch(s),
        onKeyDown:(e)=>e.key==="Enter"&&launch(s)
      },
        h("span",{className:"icon"},txt(s.icon)),
        h("span",{className:"name"},txt(s.name)),
        h("span",{className:"version"},txt(s.version))
      );
      grid.appendChild(card);
    }
  }).catch(err => {
    const el = $(".shell-error",root);
    if (el) el.textContent = String(err);
  });

  const sel = h("div",{className:"shell-selector"},
    header, sub,
    h("p",{style:{color:"#888",fontSize:"13px"},className:"shell-error"}),
    h("div",{className:"shell-grid"})
  );
  root.appendChild(sel);
}

async function launch(shell) {
  try {
    const id = await invoke("launch_shell",{shellPath:shell.path,shellArgs:shell.args});
    activeShell = shell;
    ptyId = id;
    phase = "terminal";
    render();
  } catch (e) { console.error("launch failed:",e); }
}

/* ── render terminal ── */

function renderTerminal() {
  const root = document.getElementById("root");
  root.innerHTML = "";

  let settingsOpen = false;
  let settingsPanel = null;

  const close = () => {
    if (ptyId) invoke("kill_pty",{ptyId}).catch(()=>{});
    ptyId = null;
    activeShell = null;
    term = null;
    fit = null;
    phase = "select";
    render();
  };

  const toggleSettings = () => {
    settingsOpen = !settingsOpen;
    if (settingsPanel) {
      settingsPanel.style.display = settingsOpen ? "flex" : "none";
    }
  };

  // toolbar
  const toolbar = h("div",{className:"terminal-toolbar"},
    h("div",{className:"tab"},txt(activeShell ? activeShell.name : "")),
    h("div",{className:"toolbar-right"},
      h("button",{className:"settings-toggle-btn",onClick:toggleSettings},txt("\u2699")),
      h("button",{className:"close-btn",onClick:close},txt("Close"))
    )
  );

  // inline settings panel (hidden by default)
  settingsPanel = h("div",{className:"terminal-settings-panel",style:{display:"none"}});
  settingsPanel.appendChild(buildInlineSettings());

  function buildInlineSettings() {
    const frag = document.createDocumentFragment();

    // font selector
    const sel = h("select",{className:"ts-select"});
    sel.value = settings.font_family;
    for (const f of FONTS) {
      const opt = h("option",{value:f.v},txt(f.l));
      sel.appendChild(opt);
    }
    sel.addEventListener("change",()=>{
      settings.font_family = sel.value;
      if (term) term.options.fontFamily = settings.font_family;
      invoke("update_settings",{settings}).catch(()=>{});
    });

    const fontLbl = h("label",{className:"ts-setting"},
      h("span",{className:"ts-label"},txt("Font")), sel
    );
    frag.appendChild(fontLbl);

    // size slider
    const range = h("input",{type:"range",min:"10",max:"24",step:"1"});
    range.value = String(settings.font_size);
    const valSpan = h("span",{className:"ts-size-value"},txt(settings.font_size+"px"));

    range.addEventListener("input",()=>{
      const sz = Number(range.value);
      settings.font_size = sz;
      valSpan.textContent = sz+"px";
      if (term && fit) {
        term.options.fontSize = sz;
        requestAnimationFrame(()=>{ try{fit.fit();}catch(_){} });
      }
      invoke("update_settings",{settings}).catch(()=>{});
    });

    const sizeCtrl = h("div",{className:"ts-size-control"},range,valSpan);
    const sizeLbl = h("label",{className:"ts-setting"},
      h("span",{className:"ts-label"},txt("Size")), sizeCtrl
    );
    frag.appendChild(sizeLbl);

    // close panel on click outside
    document.addEventListener("mousedown",function handler(e){
      if (settingsOpen && settingsPanel && !settingsPanel.contains(e.target) && !e.target.closest(".settings-toggle-btn")) {
        settingsOpen = false;
        settingsPanel.style.display = "none";
        document.removeEventListener("mousedown",handler);
      }
    });

    return frag;
  }

  // terminal container
  const container = h("div",{className:"terminal-container"});
  termContainer = container;

  root.appendChild(toolbar);
  root.appendChild(settingsPanel);
  root.appendChild(container);

  // ── init xterm ──
  fit = new FitAddon();
  term = new Terminal({
    cursorBlink:true,cursorStyle:"block",
    fontSize:settings.font_size,fontFamily:settings.font_family,
    theme:{
      background:"#0e0e1a",foreground:"#d0d0d0",cursor:"#e0e0e0",
      selectionBackground:"#334",
      black:"#1a1a2e",red:"#e57373",green:"#81c784",yellow:"#ffd54f",
      blue:"#64b5f6",magenta:"#ce93d8",cyan:"#4dd0e1",white:"#d0d0d0",
      brightBlack:"#444",brightRed:"#ef9a9a",brightGreen:"#a5d6a7",
      brightYellow:"#fff176",brightBlue:"#90caf9",brightMagenta:"#e1bee7",
      brightCyan:"#80deea",brightWhite:"#f5f5f5",
    },
    allowTransparency:false,cols:80,rows:24,
  });
  term.loadAddon(fit);
  term.open(container);
  requestAnimationFrame(() => { try{fit.fit();}catch(_){} });

  // ── Tauri event listeners ──
  let un_out, un_exit;
  (async () => {
    un_out = await listen(`pty-output-${ptyId}`, ev => {
      if (term) term.write(ev.payload.data);
    });
    un_exit = await listen(`pty-exit-${ptyId}`, () => {
      if (term) term.write("\r\n\x1b[31m[process exited]\x1b[0m\r\n");
      setTimeout(close, 1500);
    });
  })();

  // input forwarding
  const disposable = term.onData(data => {
    invoke("write_pty",{ptyId,data}).catch(()=>{});
  });

  // resize observer
  const resizeObserver = new ResizeObserver(() => {
    if (!fit || !term) return;
    try { fit.fit(); } catch(_) { return; }
    invoke("resize_pty",{ptyId,cols:term.cols,rows:term.rows}).catch(()=>{});
  });
  resizeObserver.observe(container);

  // window resize (debounced)
  let timer;
  const onWinResize = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!fit || !term) return;
      try { fit.fit(); } catch(_) { return; }
      invoke("resize_pty",{ptyId,cols:term.cols,rows:term.rows}).catch(()=>{});
    }, 60);
  };
  window.addEventListener("resize",onWinResize);

  // cleanup on close
  const origClose = close;
  window.__aetherCleanup = () => {
    disposable.dispose();
    resizeObserver.disconnect();
    window.removeEventListener("resize",onWinResize);
    if (un_out) un_out();
    if (un_exit) un_exit();
    if (term) { term.dispose(); term = null; fit = null; }
  };
  const _close = close;
  window.__aetherClose = close;
}

/* ── render settings ── */

function renderSettings() {
  const root = document.getElementById("root");
  root.innerHTML = "";

  let ff = settings.font_family;
  let fs = settings.font_size;
  let saving = false;

  const header = h("div",{className:"settings-header"},
    h("button",{className:"back-btn",onClick:()=>{ phase="select"; render(); }},txt("\u2190 Back")),
    h("h1",{},txt("Settings"))
  );

  const errorP = h("p",{className:"settings-error"});
  const saveBtn = h("button",{className:"save-btn"},txt("Save"));

  const previewBox = h("div",{className:"preview-box",style:{fontFamily:ff,fontSize:fs,lineHeight:1.5}},
    h("div",{className:"preview-header"},txt("Preview")),
    h("div",{},
      h("span",{style:{color:"#e57373"}},txt("\u03bb ")),
      h("span",{style:{color:"#81c784"}},txt("~ ")),
      h("span",{style:{color:"#64b5f6"}},txt("echo ")),
      h("span",{style:{color:"#ffd54f"}},txt('"hello from nf"'))
    ),
    h("div",{style:{color:"#888"}},txt("\u279c ~ ls -la")),
    h("div",{style:{color:"#888",fontSize:fs-2}},txt("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 /home/user \u2500"))
  );

  // font picker
  const fontSel = h("select",{className:"font-picker"});
  fontSel.value = ff;
  for (const f of FONTS) {
    const opt = h("option",{value:f.v},txt(f.l));
    fontSel.appendChild(opt);
  }
  fontSel.addEventListener("change",()=>{
    ff = fontSel.value;
    previewBox.style.fontFamily = ff;
  });

  // size slider
  const range = h("input",{type:"range",min:"10",max:"24",step:"1"});
  range.value = String(fs);
  const valSpan = h("span",{className:"size-value"},txt(fs+"px"));
  range.addEventListener("input",()=>{
    fs = Number(range.value);
    valSpan.textContent = fs+"px";
    previewBox.style.fontSize = String(fs);
    const smallPreview = previewBox.lastElementChild;
    if (smallPreview) smallPreview.style.fontSize = String(fs-2);
  });

  saveBtn.addEventListener("click",async ()=>{
    if (saving) return;
    saving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving\u2026";
    errorP.textContent = "";
    const newSettings = { font_family: ff, font_size: fs };
    try {
      await invoke("update_settings",{settings:newSettings});
      settings = newSettings;
      phase = "select";
      render();
    } catch (e) {
      errorP.textContent = String(e);
      saving = false;
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  });

  const body = h("div",{className:"settings-body"},
    h("label",{className:"setting-row"},
      h("span",{className:"setting-label"},txt("Terminal font")), fontSel
    ),
    h("label",{className:"setting-row"},
      h("span",{className:"setting-label"},txt("Font size")),
      h("div",{className:"size-control"},range,valSpan)
    ),
    previewBox,
    errorP,
    saveBtn
  );

  root.appendChild(header);
  root.appendChild(body);
}

/* ── main render ── */

function render() {
  // cleanup any running terminal
  if (phase !== "terminal" && window.__aetherCleanup) {
    window.__aetherCleanup();
    window.__aetherCleanup = null;
  }
  if (phase === "terminal" && window.__aetherClose) {
    // let renderTerminal handle cleanup on its own close
  }

  if (phase === "select")      renderSelect();
  else if (phase === "terminal") renderTerminal();
  else if (phase === "settings") renderSettings();
}

/* ── boot ── */

invoke("get_settings").then(s => {
  settings = { ...DEFAULT, ...s };
  render();
}).catch(() => {
  render();
});