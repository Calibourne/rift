/// Shared font catalogue used by the terminal and the settings page.

export interface FontOption {
  label: string;
  value: string;
}

export const FONT_OPTIONS: FontOption[] = [
  // --- Nerd-font-ready (patched or ligature-rich) ---
  { label: "JetBrains Mono", value: "'JetBrainsMono Nerd Font', 'JetBrains Mono', 'Fira Code', monospace" },
  { label: "Fira Code", value: "'FiraCode Nerd Font', 'Fira Code', 'JetBrains Mono', monospace" },
  { label: "Cascadia Code", value: "'Cascadia Code', 'Cascadia Mono', 'CaskaydiaCove Nerd Font', monospace" },
  { label: "Meslo", value: "'MesloLGS Nerd Font', 'Meslo LG S', 'Menlo', monospace" },
  { label: "Hack", value: "'Hack Nerd Font', Hack, 'Courier New', monospace" },
  { label: "Victor Mono", value: "'VictorMono Nerd Font', 'Victor Mono', 'JetBrains Mono', monospace" },
  { label: "Iosevka", value: "'Iosevka Nerd Font', Iosevka, monospace" },
  { label: "Source Code Pro", value: "'SauceCodePro Nerd Font', 'Source Code Pro', monospace" },
  { label: "Ubuntu Mono", value: "'UbuntuMono Nerd Font', 'Ubuntu Mono', monospace" },
  { label: "DejaVu Sans Mono", value: "'DejaVuSansMono Nerd Font', 'DejaVu Sans Mono', monospace" },
  // --- Standard monospace fallbacks ---
  { label: "Menlo", value: "Menlo, Monaco, 'Courier New', monospace" },
  { label: "Consolas", value: "Consolas, 'Courier New', monospace" },
  { label: "Inconsolata", value: "Inconsolata, 'DejaVu Sans Mono', monospace" },
  { label: "Courier New", value: "'Courier New', monospace" },
];