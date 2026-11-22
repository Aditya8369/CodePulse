import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input, SearchInput } from "./input";

describe("Input Component - Clear 'X' Button with Smooth Fade In/Out", () => {
  it("renders standard input without clear button when empty", () => {
    render(<Input placeholder="Type here..." clearable />);
    expect(screen.queryByTestId("input-clear-button")).not.toBeInTheDocument();
  });

  it("shows clear button when text is entered in clearable input", () => {
    render(<Input placeholder="Search..." clearable defaultValue="Next.js" />);
    const clearBtn = screen.getByTestId("input-clear-button");
    expect(clearBtn).toBeInTheDocument();
    expect(clearBtn).toHaveAttribute("aria-label", "Clear input");
  });

  it("calls onClear callback when clear button is clicked", () => {
    const onClear = vi.fn();
    render(<Input clearable value="TypeScript" onClear={onClear} onChange={() => {}} />);

    const clearBtn = screen.getByTestId("input-clear-button");
    fireEvent.click(clearBtn);

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("automatically enables clear button when type is 'search'", () => {
    render(<SearchInput defaultValue="React query" />);
    const clearBtn = screen.getByTestId("input-clear-button");
    expect(clearBtn).toBeInTheDocument();
  });

  it("hides clear button when input is disabled", () => {
    render(<Input clearable defaultValue="Disabled text" disabled />);
    expect(screen.queryByTestId("input-clear-button")).not.toBeInTheDocument();
  });
});
