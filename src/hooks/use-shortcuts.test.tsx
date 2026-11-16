import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderHook } from "@testing-library/react";
import { useShortcuts } from "./use-shortcuts";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  document.body.innerHTML = "";
  push.mockClear();
  vi.useRealTimers();
});

describe("useShortcuts", () => {
  it("opens help with ? but ignores typing and other open dialogs", () => {
    const onShowHelp = vi.fn();
    renderHook(() => useShortcuts({ onShowHelp }));
    const input = document.createElement("input");
    document.body.append(input);

    fireEvent.keyDown(input, { key: "?", code: "Slash", shiftKey: true });
    expect(onShowHelp).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "?", code: "Slash", shiftKey: true });
    expect(onShowHelp).toHaveBeenCalledTimes(1);

    const dialog = document.createElement("div");
    dialog.setAttribute("aria-modal", "true");
    document.body.append(dialog);
    fireEvent.keyDown(window, { key: "?" });
    expect(onShowHelp).toHaveBeenCalledTimes(1);
  });

  it("navigates on G then a route key and discards expired sequences", () => {
    vi.useFakeTimers();
    renderHook(() => useShortcuts({ onShowHelp: vi.fn() }));

    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "c" });
    expect(push).toHaveBeenCalledWith("/challenges");

    fireEvent.keyDown(window, { key: "g" });
    vi.advanceTimersByTime(1201);
    fireEvent.keyDown(window, { key: "p" });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("does not run while disabled", () => {
    const onShowHelp = vi.fn();
    renderHook(() => useShortcuts({ onShowHelp, disabled: true }));
    fireEvent.keyDown(window, { key: "?" });
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "d" });
    expect(onShowHelp).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
