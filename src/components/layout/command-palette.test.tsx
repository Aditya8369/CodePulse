import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CommandPalette } from "./command-palette";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/api/use-auth", () => ({
  useCurrentUser: () => ({ data: { username: "octocat", repositories: [] } }),
}));

describe("CommandPalette '?' Keyboard Shortcuts Dialog", () => {
  it("opens keyboard shortcuts dialog when '?' key is pressed globally", () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open={true} onOpenChange={onOpenChange} />);

    // Press '?'
    fireEvent.keyDown(document, { key: "?" });

    expect(screen.getByTestId("shortcuts-dialog-content")).toBeInTheDocument();
    expect(screen.getByText("Global Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Global Navigation (G then Key)")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Battles Arena")).toBeInTheDocument();
  });

  it("toggles shortcuts mode via footer shortcuts button", () => {
    render(<CommandPalette open={true} onOpenChange={vi.fn()} />);

    const toggleBtn = screen.getByTestId("shortcuts-toggle-btn");
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId("shortcuts-dialog-content")).toBeInTheDocument();
  });
});
