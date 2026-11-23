import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VoiceAssistantModal } from "./voice-assistant-modal";

describe("VoiceAssistantModal (Waveform, Code Highlights, Mute, Push-to-Talk & Export)", () => {
  it("highlights synchronized code lines and handles mute, push-to-talk, and transcript export", () => {
    const onExport = vi.fn();

    render(
      <VoiceAssistantModal
        isOpen={true}
        filePath="backend/src/prisma/prisma.service.ts"
        highlightStartLine={15}
        highlightEndLine={16}
        codeLines={[
          { lineNumber: 14, content: "async executeTx() {" },
          { lineNumber: 15, content: "  return this.deadlockResolver.executeWithDeadlockRetry();" },
          { lineNumber: 16, content: "}" },
        ]}
        onExportTranscript={onExport}
      />
    );

    expect(screen.getByTestId("code-line-14").getAttribute("data-highlighted")).toBe("false");
    expect(screen.getByTestId("code-line-15").getAttribute("data-highlighted")).toBe("true");
    expect(screen.getByTestId("code-line-16").getAttribute("data-highlighted")).toBe("true");

    fireEvent.click(screen.getByTestId("voice-mute-btn"));
    expect(screen.getByTestId("voice-mute-btn").textContent).toContain("Unmute Mic");

    fireEvent.click(screen.getByTestId("voice-ptt-btn"));
    expect(screen.getByTestId("voice-ptt-btn").textContent).toContain("Transmitting");

    fireEvent.click(screen.getByTestId("voice-export-btn"));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("transcript-export-status")).toBeTruthy();
  });
});
