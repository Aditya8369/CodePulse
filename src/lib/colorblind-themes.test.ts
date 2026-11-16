import { describe, expect, it } from "vitest";
import { applyColorVisionTheme, COLOR_VISION_THEMES } from "./colorblind-themes";

function luminance(hex: string) {
  const [r, g, b] = hex.match(/[a-f\d]{2}/gi)!.map((part) => {
    const channel = Number.parseInt(part, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("color vision status palettes", () => {
  it("keeps each status text color at WCAG AAA contrast against its canvas", () => {
    for (const preset of Object.values(COLOR_VISION_THEMES)) {
      for (const mode of ["dark", "light"] as const) {
        const canvas = mode === "dark" ? "#111827" : "#ffffff";
        expect(contrast(preset[mode].success, canvas)).toBeGreaterThanOrEqual(7);
        expect(contrast(preset[mode].danger, canvas)).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it("updates semantic status and chart colors on the document root", () => {
    applyColorVisionTheme("protanopia", "dark");
    expect(document.documentElement.dataset.colorblindTheme).toBe("protanopia");
    expect(document.documentElement.style.getPropertyValue("--status-success")).toBe("#93c5fd");
    expect(document.documentElement.style.getPropertyValue("--chart-negative")).toBe("#fcd34d");
    applyColorVisionTheme("tritanopia", "light");
    expect(document.documentElement.style.getPropertyValue("--status-success")).toBe("#155e75");
    expect(document.documentElement.style.getPropertyValue("--status-danger")).toBe("#9a3412");
    applyColorVisionTheme("invalid", "light");
    expect(document.documentElement.dataset.colorblindTheme).toBe("normal");
  });
});
