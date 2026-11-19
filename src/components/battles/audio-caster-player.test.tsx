import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  AudioCasterPlayer,
  IncomingAudioCommentaryChunk,
} from "./audio-caster-player";

describe("AudioCasterPlayer (Live AI Shoutcaster Component)", () => {
  it("toggles between Energetic Hype Caster and Calm Technical Analyst styles", () => {
    const onStyleChange = vi.fn();
    render(
      <AudioCasterPlayer
        battleId="battle-77"
        initialStyle="HYPE_CASTER"
        onStyleChange={onStyleChange}
      />
    );

    const analystBtn = screen.getByRole("button", {
      name: /Calm Technical Analyst/i,
    });
    fireEvent.click(analystBtn);

    expect(onStyleChange).toHaveBeenCalledWith("TECHNICAL_ANALYST");
  });

  it("buffers incoming WebSocket TTS chunks and renders emotion badge & live transcript", () => {
    const chunk0: IncomingAudioCommentaryChunk = {
      streamId: "stream-1",
      battleId: "battle-77",
      lineId: "line-1",
      chunkIndex: 0,
      totalChunks: 2,
      isFinal: false,
      mimeType: "audio/wav",
      sampleRate: 16000,
      audioBase64: "UklGRg==",
      transcript:
        "Player A has just optimized their loop to O(N)! Can Player B catch up before time expires?!",
      emotion: "Hype",
      style: "HYPE_CASTER",
      latencyMs: 14.2,
    };

    const { rerender } = render(
      <AudioCasterPlayer battleId="battle-77" incomingChunk={chunk0} />
    );

    expect(screen.getByTestId("caster-emotion-badge").textContent).toBe("Hype");
    expect(screen.getByTestId("caster-live-caption").textContent).toContain(
      "optimized their loop to O(N)"
    );
    expect(screen.getByTestId("caster-stream-count").textContent).toContain(
      "Streams: 0"
    );

    const chunk1: IncomingAudioCommentaryChunk = {
      ...chunk0,
      chunkIndex: 1,
      isFinal: true,
      audioBase64: "V0FWRQ==",
    };

    rerender(<AudioCasterPlayer battleId="battle-77" incomingChunk={chunk1} />);
    expect(screen.getByTestId("caster-stream-count").textContent).toContain(
      "Streams: 1"
    );
  });
});
