import { afterEach, describe, expect, it } from "vitest";
import {
  accentContrastOnWhite,
  applyDeveloperTheme,
  DEVELOPER_THEMES,
  isReadableAccent,
  monacoDeveloperTheme,
} from "./developer-themes";

afterEach(() => applyDeveloperTheme("default", null));

describe("developer themes", () => {
  it("keeps every preset accent readable with white text", () => {
    for (const palette of Object.values(DEVELOPER_THEMES)) {
      expect(accentContrastOnWhite(palette.accent)).toBeGreaterThanOrEqual(4.5);
    }
    expect(isReadableAccent("#ffcc00")).toBe(false);
    expect(isReadableAccent("not a color")).toBe(false);
  });

  it("applies a palette and resets all inline tokens in light mode", () => {
    expect(applyDeveloperTheme("nord", "#234567")).toBe("nord");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("#234567");
    expect(document.documentElement.style.getPropertyValue("--background")).toBe("#202a39");
    expect(document.documentElement.style.getPropertyValue("--background-glow")).toBe("#234567");
    expect(document.documentElement.style.getPropertyValue("--card-border")).toContain("#234567");
    expect(applyDeveloperTheme("nord", null, true)).toBe("default");
    expect(document.documentElement.dataset.developerTheme).toBe("default");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--card-border")).toBe("");
  });

  it("rejects unreadable custom accents", () => {
    applyDeveloperTheme("cyberpunk", "#ffffff");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(DEVELOPER_THEMES.cyberpunk.accent);
  });

  it("defines matching Monaco tokens and rejects an unreadable editor accent", () => {
    const theme = monacoDeveloperTheme("dracula", "#ffffff");
    expect(theme.colors["editor.background"]).toBe(DEVELOPER_THEMES.dracula.background);
    expect(theme.colors["editorCursor.foreground"]).toBe(DEVELOPER_THEMES.dracula.accent);
    expect(theme.rules[0].foreground).toBe(DEVELOPER_THEMES.dracula.accent.slice(1));
  });
});
