import { afterEach, describe, expect, it } from "vitest";
import {
  accentContrastOnWhite,
  applyDeveloperTheme,
  DEVELOPER_THEMES,
  isReadableAccent,
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
    expect(applyDeveloperTheme("nord", null, true)).toBe("default");
    expect(document.documentElement.dataset.developerTheme).toBe("default");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("");
  });

  it("rejects unreadable custom accents", () => {
    applyDeveloperTheme("cyberpunk", "#ffffff");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(DEVELOPER_THEMES.cyberpunk.accent);
  });
});
