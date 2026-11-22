import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SheetContent, SheetOverlay } from "@/components/ui/sheet";

describe("Sheet Monaco Editor Collision Prevention", () => {
  it("renders SheetOverlay with z-[60] and backdrop blur to prevent Monaco collision", () => {
    const { container } = render(
      <SheetOverlay data-testid="test-sheet-overlay" />
    );
    const overlay = container.querySelector("[data-slot='sheet-overlay']");
    expect(overlay).toBeInTheDocument();
    expect(overlay?.className).toContain("z-[60]");
    expect(overlay?.className).toContain("backdrop-blur-md");
  });

  it("renders SheetContent with z-[70] exceeding Monaco Editor z-indices", () => {
    const { container } = render(
      <SheetContent data-testid="test-sheet-content" side="left">
        <div>Mobile Nav Content</div>
      </SheetContent>
    );
    const popup = container.querySelector("[data-slot='sheet-content']");
    expect(popup).toBeInTheDocument();
    expect(popup?.className).toContain("z-[70]");
  });
});
