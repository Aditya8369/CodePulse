import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { StandupGeneratorModal } from "./standup-generator-modal";
import type { Activity } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("StandupGeneratorModal with Weekly & Daily Summaries", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(12, 0, 0, 0);

  const activities: Activity[] = [
    {
      id: "push-1",
      type: "commit",
      title: "Pushed 1 commit",
      description: "Synced from GitHub",
      repository: "CodePulse/core",
      createdAt: yesterday.toISOString(),
      metadata: { commitMessages: ["Fix retry behavior in socket client"] },
    },
  ];

  it("renders weekly standup markdown summary by default and allows copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    render(<StandupGeneratorModal open onClose={() => {}} activities={activities} />);

    expect(screen.getByTestId("standup-generator-modal")).toBeInTheDocument();
    expect(screen.getByText("Weekly Engineering Standup Digest")).toBeInTheDocument();

    const textarea = screen.getByTestId("standup-draft-textarea") as HTMLTextAreaElement;
    expect(textarea.value).toContain("Weekly Engineering Standup & Sprint Summary");

    // Click Copy button
    fireEvent.click(screen.getByTestId("copy-standup-draft-btn"));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
  });

  it("switches to daily mode and changes output format to Slack", () => {
    render(<StandupGeneratorModal open onClose={() => {}} activities={activities} />);

    // Switch to Daily Mode
    const dailyBtn = screen.getByTestId("mode-daily-btn");
    fireEvent.click(dailyBtn);

    expect(screen.getByText(/Daily Standup Draft/i)).toBeInTheDocument();

    // Switch to Slack format
    const slackBtn = screen.getByRole("button", { name: "Slack" });
    fireEvent.click(slackBtn);

    const textarea = screen.getByTestId("standup-draft-textarea") as HTMLTextAreaElement;
    expect(textarea.value).toContain("*Yesterday*");
  });
});
