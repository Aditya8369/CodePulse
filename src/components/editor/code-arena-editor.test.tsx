import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  CodeArenaEditor,
  MONOSPACE_FONTS,
  type MonospaceFont,
} from "./code-arena-editor";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CodeArenaEditor Component - Monospace Font Toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default monospace font (JetBrains Mono)", () => {
    render(<CodeArenaEditor />);
    const textarea = screen.getByTestId("code-arena-textarea");
    expect(textarea).toBeInTheDocument();
    expect(textarea.style.fontFamily).toContain("JetBrains Mono");
  });

  it("respects custom initialFont prop", () => {
    render(<CodeArenaEditor initialFont="fira-code" />);
    const textarea = screen.getByTestId("code-arena-textarea");
    expect(textarea.style.fontFamily).toContain("Fira Code");
  });

  it("respects Source Code Pro as initial font", () => {
    render(<CodeArenaEditor initialFont="source-code-pro" />);
    const textarea = screen.getByTestId("code-arena-textarea");
    expect(textarea.style.fontFamily).toContain("Source Code Pro");
  });

  it("renders the font toggle trigger button with aria-label", () => {
    render(<CodeArenaEditor />);
    const fontButton = screen.getByTestId("font-toggle-button");
    expect(fontButton).toBeInTheDocument();
    expect(fontButton).toHaveAttribute("aria-label", "Toggle Monospace Font");
  });

  it("defines all three required monospace fonts in MONOSPACE_FONTS", () => {
    const fontIds = MONOSPACE_FONTS.map((f) => f.id);
    expect(fontIds).toContain("jetbrains-mono");
    expect(fontIds).toContain("fira-code");
    expect(fontIds).toContain("source-code-pro");
    expect(MONOSPACE_FONTS).toHaveLength(3);
  });
});
