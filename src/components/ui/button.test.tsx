import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, CopyButton } from "./button";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Button & CopyButton Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders basic button with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("renders CopyButton with copy icon", () => {
    render(<CopyButton value="git clone https://github.com/test.git" />);
    expect(screen.getByTestId("copy-icon-clipboard")).toBeInTheDocument();
  });

  it("copies value to clipboard and switches to check icon on click", async () => {
    const onCopySuccess = vi.fn();
    render(
      <CopyButton
        value="https://codepulse.dev"
        onCopySuccess={onCopySuccess}
      />,
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://codepulse.dev");
    expect(await screen.findByTestId("copy-icon-check")).toBeInTheDocument();
    expect(onCopySuccess).toHaveBeenCalled();
  });
});
