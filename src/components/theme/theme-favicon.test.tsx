import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ThemeFavicon, generateFaviconWithBadge } from "./theme-favicon";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

vi.mock("@/hooks/api/use-notifications", () => ({
  useNotifications: () => ({ unreadCount: 5 }),
}));

describe("ThemeFavicon dynamic badge counter", () => {
  beforeEach(() => {
    document.head.innerHTML = '<link rel="icon" href="/favicon-dark.svg" />';
    document.title = "CodePulse";
  });

  it("generates correct data URI with notification badge for count > 0", () => {
    const badgeUri = generateFaviconWithBadge("dark", 5);
    expect(badgeUri).toContain("data:image/svg+xml");
    expect(decodeURIComponent(badgeUri)).toContain("5");
    expect(decodeURIComponent(badgeUri)).toContain("#ef4444");
  });

  it("returns base svg href when count is 0", () => {
    expect(generateFaviconWithBadge("dark", 0)).toBe("/favicon-dark.svg");
    expect(generateFaviconWithBadge("light", 0)).toBe("/favicon-light.svg");
  });

  it("updates document favicon link and title prefix when mounted", () => {
    render(<ThemeFavicon unreadCountOverride={3} />);

    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(link).toBeDefined();
    expect(link?.href).toContain("data:image/svg+xml");
    expect(document.title).toContain("(3)");
  });
});
