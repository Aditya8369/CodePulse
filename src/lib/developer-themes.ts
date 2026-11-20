export const DEVELOPER_THEMES = {
  default: {
    label: "Default",
    description: "The original CodePulse palette",
    background: "#121622",
    surface: "#202536",
    accent: "#6840a1",
  },
  cyberpunk: {
    label: "Cyberpunk",
    description: "Electric pink on midnight blue",
    background: "#0b1024",
    surface: "#17203d",
    accent: "#8b206d",
  },
  synthwave: {
    label: "Synthwave",
    description: "Violet and magenta after dark",
    background: "#1a1030",
    surface: "#2a1b45",
    accent: "#7c2d93",
  },
  nord: {
    label: "Nord",
    description: "Cool slate and glacier blue",
    background: "#202a39",
    surface: "#303d50",
    accent: "#445a88",
  },
  dracula: {
    label: "Dracula",
    description: "Deep plum and muted lavender",
    background: "#1c1927",
    surface: "#2b2638",
    accent: "#5a407d",
  },
} as const;

export type DeveloperTheme = keyof typeof DEVELOPER_THEMES;

export function isDeveloperTheme(value: unknown): value is DeveloperTheme {
  return typeof value === "string" && Object.hasOwn(DEVELOPER_THEMES, value);
}

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** White labels on user-selected accents must meet WCAG AA normal-text contrast. */
export function accentContrastOnWhite(value: unknown): number {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) return 0;
  const rgb = [1, 3, 5].map((index) => channel(parseInt(value.slice(index, index + 2), 16)));
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return 1.05 / (luminance + 0.05);
}

export function isReadableAccent(value: unknown): value is string {
  return accentContrastOnWhite(value) >= 4.5;
}

/** Monaco's IStandaloneThemeData shape, kept dependency-free until an editor is mounted. */
export function monacoDeveloperTheme(theme: DeveloperTheme, customAccent?: string | null) {
  const palette = DEVELOPER_THEMES[theme];
  const accent = isReadableAccent(customAccent) ? customAccent : palette.accent;
  return {
    base: "vs-dark" as const,
    inherit: true,
    rules: [
      { token: "keyword", foreground: accent.slice(1) },
      { token: "string", foreground: "86efac" },
      { token: "comment", foreground: "94a3b8" },
    ],
    colors: {
      "editor.background": palette.background,
      "editor.foreground": "#f8fafc",
      "editor.lineHighlightBackground": palette.surface,
      "editorCursor.foreground": accent,
    },
  };
}

const OVERRIDDEN_PROPERTIES = [
  "--background", "--card", "--popover", "--secondary", "--muted", "--accent",
  "--primary", "--ring", "--chart-1", "--sidebar", "--sidebar-primary",
  "--sidebar-ring", "--sidebar-accent",
  "--background-glow", "--card-border",
] as const;

/** Apply only palette tokens; color-vision status tokens remain independent. */
export function applyDeveloperTheme(theme: unknown, customAccent: unknown, isLight = false): DeveloperTheme {
  const selected = !isLight && isDeveloperTheme(theme) ? theme : "default";
  if (typeof document === "undefined") return selected;

  const root = document.documentElement;
  for (const property of OVERRIDDEN_PROPERTIES) root.style.removeProperty(property);
  root.dataset.developerTheme = selected;
  if (selected === "default") return selected;

  const palette = DEVELOPER_THEMES[selected];
  const accent = isReadableAccent(customAccent) ? customAccent : palette.accent;
  root.style.setProperty("--background", palette.background);
  root.style.setProperty("--card", palette.surface);
  root.style.setProperty("--popover", palette.surface);
  root.style.setProperty("--secondary", palette.surface);
  root.style.setProperty("--muted", palette.surface);
  root.style.setProperty("--accent", palette.surface);
  root.style.setProperty("--primary", accent);
  root.style.setProperty("--ring", accent);
  root.style.setProperty("--chart-1", accent);
  root.style.setProperty("--sidebar", palette.background);
  root.style.setProperty("--sidebar-primary", accent);
  root.style.setProperty("--sidebar-ring", accent);
  root.style.setProperty("--sidebar-accent", palette.surface);
  root.style.setProperty("--background-glow", accent);
  root.style.setProperty("--card-border", `color-mix(in srgb, ${accent} 28%, transparent)`);
  return selected;
}
