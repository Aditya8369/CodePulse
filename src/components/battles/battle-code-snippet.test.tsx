import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { toast } from "sonner";
import { BattleCodeSnippet, splitCodeLines } from "./battle-code-snippet";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const SAMPLE = "const a = 1;\nconst b = 2;\n\nconsole.log(a + b);";

function setClipboard(writeText: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value: writeText === undefined ? undefined : { writeText },
    configurable: true,
  });
}

describe("splitCodeLines", () => {
  it("splits on newlines and keeps blank lines in the middle", () => {
    expect(splitCodeLines("a\n\nb")).toEqual(["a", "", "b"]);
  });

  it("drops one trailing newline but not a second blank line", () => {
    expect(splitCodeLines("a\nb\n")).toEqual(["a", "b"]);
    expect(splitCodeLines("a\n\n")).toEqual(["a", ""]);
  });

  it("handles Windows and old Mac line endings", () => {
    expect(splitCodeLines("a\r\nb\rc")).toEqual(["a", "b", "c"]);
  });

  it("returns one empty line for an empty string", () => {
    expect(splitCodeLines("")).toEqual([""]);
  });
});

describe("BattleCodeSnippet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setClipboard(vi.fn().mockResolvedValue(undefined));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows one numbered row per line, starting at 1", () => {
    render(<BattleCodeSnippet code={SAMPLE} language="typescript" />);

    const numbers = screen.getAllByTestId("line-number").map((n) => n.textContent);
    expect(numbers).toEqual(["1", "2", "3", "4"]);
    expect(screen.getAllByTestId("code-line")).toHaveLength(4);
  });

  it("does not add a numbered row for a trailing newline", () => {
    render(<BattleCodeSnippet code={"a\nb\n"} />);
    expect(screen.getAllByTestId("code-line")).toHaveLength(2);
  });

  it("hides the line numbers from screen readers", () => {
    render(<BattleCodeSnippet code={SAMPLE} />);
    for (const number of screen.getAllByTestId("line-number")) {
      expect(number).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("can hide the line numbers", () => {
    render(<BattleCodeSnippet code={SAMPLE} showLineNumbers={false} />);
    expect(screen.queryAllByTestId("line-number")).toHaveLength(0);
    expect(screen.getAllByTestId("code-line")).toHaveLength(4);
  });

  it("shows the language badge when a language is given", () => {
    render(<BattleCodeSnippet code={SAMPLE} language="rust" />);
    expect(screen.getByText("rust")).toBeInTheDocument();
    expect(screen.getByLabelText("rust code")).toBeInTheDocument();
  });

  it("shows no badge without a language", () => {
    render(<BattleCodeSnippet code={SAMPLE} />);
    expect(screen.getByLabelText("Code")).toBeInTheDocument();
    expect(screen.queryByText("typescript")).not.toBeInTheDocument();
  });

  it("lets keyboard users focus the code to scroll it", () => {
    render(<BattleCodeSnippet code={SAMPLE} />);
    expect(screen.getByLabelText("Code")).toHaveAttribute("tabindex", "0");
  });

  it("copies exactly the code, including blank lines and a trailing newline", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    const code = "line one\n\n  indented\n";

    render(<BattleCodeSnippet code={code} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    });

    expect(writeText).toHaveBeenCalledWith(code);
    expect(toast.success).toHaveBeenCalledWith("Code copied to clipboard!");
  });

  it("shows the check for 2 seconds, then goes back to Copy", async () => {
    vi.useFakeTimers();
    render(<BattleCodeSnippet code={SAMPLE} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    });
    expect(screen.getByText("Copied")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Code copied to clipboard");

    // The issue asks for 2 seconds, so this is written out, not imported.
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByText("Copied")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("restarts the 2 seconds when copied again before it ends", async () => {
    vi.useFakeTimers();
    render(<BattleCodeSnippet code={SAMPLE} />);
    const button = screen.getByRole("button", { name: "Copy code" });

    await act(async () => {
      fireEvent.click(button);
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      fireEvent.click(button);
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // 3000ms after the first copy, but only 1500ms after the second.
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("reports an error and keeps the Copy button when the clipboard refuses", async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));

    render(<BattleCodeSnippet code={SAMPLE} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    });

    expect(toast.error).toHaveBeenCalledWith("Could not copy the code.");
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
  });

  it("reports an error when the Clipboard API does not exist", async () => {
    setClipboard(undefined);

    render(<BattleCodeSnippet code={SAMPLE} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    });

    expect(toast.error).toHaveBeenCalledWith("Could not copy the code.");
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
  });

  it("does not update state if it is removed while the copy is pending", async () => {
    let resolveCopy: () => void = () => {};
    setClipboard(
      vi.fn().mockReturnValue(new Promise<void>((resolve) => (resolveCopy = resolve)))
    );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = render(<BattleCodeSnippet code={SAMPLE} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    unmount();
    await act(async () => {
      resolveCopy();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
