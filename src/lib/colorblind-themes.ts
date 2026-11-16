/** Status colors are paired for a dark canvas and a white canvas. Each text
 * color has at least a 7:1 contrast ratio on its corresponding canvas. */
export const COLOR_VISION_THEMES = {
  normal: {
    label: "Normal color vision",
    description: "Green for success, red for danger",
    dark: { success: "#86efac", danger: "#fca5a5" },
    light: { success: "#166534", danger: "#991b1b" },
  },
  protanopia: {
    label: "Protanopia",
    description: "Blue for success, yellow for danger",
    dark: { success: "#93c5fd", danger: "#fcd34d" },
    light: { success: "#1e40af", danger: "#92400e" },
  },
  deuteranopia: {
    label: "Deuteranopia",
    description: "Blue for success, orange for danger",
    dark: { success: "#bfdbfe", danger: "#fdba74" },
    light: { success: "#1e3a8a", danger: "#7c2d12" },
  },
  tritanopia: {
    label: "Tritanopia",
    description: "Cyan for success, red-orange for danger",
    dark: { success: "#67e8f9", danger: "#fb923c" },
    light: { success: "#155e75", danger: "#9a3412" },
  },
  monochrome: {
    label: "Monochrome high contrast",
    description: "White and gray with explicit status labels",
    dark: { success: "#f8fafc", danger: "#cbd5e1" },
    light: { success: "#111827", danger: "#334155" },
  },
} as const;

export type ColorVisionTheme = keyof typeof COLOR_VISION_THEMES;

export function isColorVisionTheme(value: unknown): value is ColorVisionTheme {
  return typeof value === "string" && value in COLOR_VISION_THEMES;
}

export function applyColorVisionTheme(
  value: unknown,
  mode: "dark" | "light",
): ColorVisionTheme {
  const theme = isColorVisionTheme(value) ? value : "normal";
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    const colors = COLOR_VISION_THEMES[theme][mode];
    root.dataset.colorblindTheme = theme;
    root.style.setProperty("--status-success", colors.success);
    root.style.setProperty("--status-danger", colors.danger);
    root.style.setProperty("--chart-positive", colors.success);
    root.style.setProperty("--chart-negative", colors.danger);
  }
  return theme;
}
