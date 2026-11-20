import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShortcutsModal } from "./shortcuts-modal";

describe("ShortcutsModal", () => {
  it("opens an accessible dialog, keeps focus inside it, and closes with Escape", async () => {
    const onClose = vi.fn();
    render(<ShortcutsModal isOpen onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "Keyboard Shortcuts" });
    expect(screen.getByText("Navigate to Challenges")).toBeInTheDocument();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
