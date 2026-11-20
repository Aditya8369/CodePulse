import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StandupGeneratorModal } from "./standup-generator-modal";
import type { Activity } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("StandupGeneratorModal", () => {
  it("switches formats and copies the edited draft", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    const activities: Activity[] = [{
      id: "push-1",
      type: "commit",
      title: "Pushed 1 commit",
      description: "Synced from GitHub",
      repository: "team/api",
      createdAt: yesterday.toISOString(),
      metadata: { commitMessages: ["Fix retry behavior"] },
    }];

    render(<StandupGeneratorModal open onClose={() => {}} activities={activities} />);
    fireEvent.click(screen.getByRole("button", { name: "Slack" }));
    const draft = screen.getByRole("textbox", { name: "Standup draft" }) as HTMLTextAreaElement;
    expect(draft.value).toContain("*Yesterday*");
    expect(draft.value).toContain("Fix retry behavior");
    fireEvent.change(draft, { target: { value: "My edited standup" } });
    fireEvent.click(screen.getByRole("button", { name: "Copy draft" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("My edited standup"));
  });
});
