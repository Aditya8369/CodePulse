import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LatencyCompensator,
  JitterBuffer,
  Frame,
  catmullRomInterpolate,
  hermiteInterpolate,
  interpolateCursorPositions,
  deadReckonTyping,
  lerp,
  getNetworkQualityColor,
  getNetworkQualityLabel,
} from "./latency-compensator";

describe("LatencyCompensator", () => {
  let compensator: LatencyCompensator;

  beforeEach(() => {
    compensator = new LatencyCompensator();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    compensator.reset();
  });

  it("initializes with zero RTT and jitter", () => {
    expect(compensator.getRtt()).toBe(0);
    expect(compensator.getJitter()).toBe(0);
  });

  it("records first RTT sample directly", () => {
    compensator.recordRttSample(100);
    expect(compensator.getRtt()).toBe(100);
    expect(compensator.getJitter()).toBe(0);
  });

  it("calculates EMA for subsequent RTT samples", () => {
    compensator.recordRttSample(100);
    compensator.recordRttSample(120);
    const rtt = compensator.getRtt();
    expect(rtt).toBeGreaterThan(100);
    expect(rtt).toBeLessThan(120);
  });

  it("calculates jitter from RTT variation", () => {
    compensator.recordRttSample(100);
    compensator.recordRttSample(150);
    expect(compensator.getJitter()).toBeGreaterThan(0);
  });

  it("computes dynamic buffer size based on jitter", () => {
    compensator.recordRttSample(100);
    compensator.recordRttSample(120);
    compensator.recordRttSample(140);
    const bufferSize = compensator.getDynamicBufferSize();
    expect(bufferSize).toBeGreaterThanOrEqual(50);
    expect(bufferSize).toBeLessThanOrEqual(200);
  });

  it("returns network quality metrics", () => {
    compensator.recordRttSample(30);
    compensator.recordRttSample(35);
    const quality = compensator.getNetworkQuality();
    expect(quality.rtt).toBeGreaterThan(0);
    expect(quality.jitter).toBeGreaterThanOrEqual(0);
    expect(["excellent", "good", "fair", "poor"]).toContain(quality.quality);
  });

  it("classifies excellent quality for low RTT and jitter", () => {
    compensator.recordRttSample(30);
    compensator.recordRttSample(32);
    const quality = compensator.getNetworkQuality();
    expect(quality.quality).toBe("excellent");
  });

  it("classifies poor quality for high RTT and jitter", () => {
    compensator.recordRttSample(300);
    compensator.recordRttSample(400);
    const quality = compensator.getNetworkQuality();
    expect(quality.quality).toBe("poor");
  });

  it("generates incrementing sequence numbers", () => {
    const seq1 = compensator.nextSequenceNumber();
    const seq2 = compensator.nextSequenceNumber();
    const seq3 = compensator.nextSequenceNumber();
    expect(seq2).toBe(seq1 + 1);
    expect(seq3).toBe(seq2 + 1);
  });

  it("resets all state", () => {
    compensator.recordRttSample(100);
    compensator.recordRttSample(150);
    compensator.nextSequenceNumber();
    compensator.reset();
    expect(compensator.getRtt()).toBe(0);
    expect(compensator.getJitter()).toBe(0);
    expect(compensator.nextSequenceNumber()).toBe(0);
  });
});

describe("JitterBuffer", () => {
  let buffer: JitterBuffer;
  let releasedFrames: Frame[];

  beforeEach(() => {
    buffer = new JitterBuffer(50);
    releasedFrames = [];
    buffer.setOnFrameRelease((frame) => releasedFrames.push(frame));
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000));
  });

  afterEach(() => {
    vi.useRealTimers();
    buffer.reset();
  });

  it("starts with empty buffer", () => {
    expect(buffer.getFrameCount()).toBe(0);
  });

  it("pushes frames in sequence order", () => {
    const frame1: Frame = { timestamp: 100, cursorPosition: 10, code: "a", sequenceNumber: 1 };
    const frame2: Frame = { timestamp: 200, cursorPosition: 20, code: "ab", sequenceNumber: 2 };
    const frame3: Frame = { timestamp: 300, cursorPosition: 30, code: "abc", sequenceNumber: 3 };

    buffer.push(frame3);
    buffer.push(frame1);
    buffer.push(frame2);

    const frames = buffer.getBufferedFrames();
    expect(frames.map(f => f.sequenceNumber)).toEqual([1, 2, 3]);
  });

  it("releases frames at regular intervals after buffer delay", () => {
    buffer.start();

    const frame1: Frame = { timestamp: 100, cursorPosition: 10, code: "a", sequenceNumber: 1 };
    const frame2: Frame = { timestamp: 200, cursorPosition: 20, code: "ab", sequenceNumber: 2 };
    buffer.push(frame1);
    buffer.push(frame2);

    buffer.releaseFrames(1050);
    expect(releasedFrames.length).toBe(1);
    expect(releasedFrames[0].sequenceNumber).toBe(1);

    buffer.releaseFrames(1100);
    expect(releasedFrames.length).toBe(2);
    expect(releasedFrames[1].sequenceNumber).toBe(2);
  });

  it("respects dynamic buffer size changes", () => {
    buffer.setBufferSize(100);
    expect(buffer.getBufferSize()).toBe(100);

    buffer.setBufferSize(300);
    expect(buffer.getBufferSize()).toBe(200);

    buffer.setBufferSize(10);
    expect(buffer.getBufferSize()).toBe(50);
  });

  it("clears buffer on reset", () => {
    const frame1: Frame = { timestamp: 100, cursorPosition: 10, code: "a", sequenceNumber: 1 };
    buffer.push(frame1);
    buffer.reset();
    expect(buffer.getFrameCount()).toBe(0);
    expect(buffer.getBufferedFrames().length).toBe(0);
  });

  it("handles out-of-order frame arrival", () => {
    const frame1: Frame = { timestamp: 100, cursorPosition: 10, code: "a", sequenceNumber: 1 };
    const frame2: Frame = { timestamp: 200, cursorPosition: 20, code: "ab", sequenceNumber: 2 };
    const frame3: Frame = { timestamp: 300, cursorPosition: 30, code: "abc", sequenceNumber: 3 };

    buffer.push(frame2);
    buffer.push(frame3);
    buffer.push(frame1);

    const frames = buffer.getBufferedFrames();
    expect(frames.map(f => f.sequenceNumber)).toEqual([1, 2, 3]);
  });
});

describe("Interpolation Functions", () => {
  it("lerp interpolates correctly", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(10, 0, 0.5)).toBe(5);
  });

  it("catmullRomInterpolate produces smooth curves", () => {
    const result = catmullRomInterpolate(0, 10, 20, 30, 0.5);
    expect(result).toBeCloseTo(15, 1);
  });

  it("hermiteInterpolate uses tangents correctly", () => {
    const result = hermiteInterpolate(0, 10, 5, 5, 0.5);
    expect(result).toBeCloseTo(5, 1);
  });

  it("interpolateCursorPositions returns predicted position for future timestamps", () => {
    const frames: Frame[] = [
      { timestamp: 1000, cursorPosition: 10, code: "a", sequenceNumber: 1 },
      { timestamp: 1016, cursorPosition: 20, code: "ab", sequenceNumber: 2 },
    ];
    const result = interpolateCursorPositions(frames, 1032);
    expect(result.position).toBeGreaterThan(20);
    expect(result.isPredicted).toBe(true);
  });

  it("interpolateCursorPositions returns interpolated position between frames", () => {
    const frames: Frame[] = [
      { timestamp: 1000, cursorPosition: 10, code: "a", sequenceNumber: 1 },
      { timestamp: 1016, cursorPosition: 20, code: "ab", sequenceNumber: 2 },
    ];
    const result = interpolateCursorPositions(frames, 1008);
    expect(result.position).toBeCloseTo(15, 0);
    expect(result.isPredicted).toBe(false);
  });

  it("interpolateCursorPositions handles single frame", () => {
    const frames: Frame[] = [
      { timestamp: 1000, cursorPosition: 10, code: "a", sequenceNumber: 1 },
    ];
    const result = interpolateCursorPositions(frames, 1008);
    expect(result.position).toBe(10);
    expect(result.isPredicted).toBe(false);
  });

  it("interpolateCursorPositions handles empty frames", () => {
    const frames: Frame[] = [];
    const result = interpolateCursorPositions(frames, 1008);
    expect(result.position).toBe(0);
    expect(result.isPredicted).toBe(true);
  });

  it("deadReckonTyping predicts code based on WPM", () => {
    const result = deadReckonTyping("hello", 5, 1000, 60);
    expect(result.code.length).toBeGreaterThanOrEqual(5);
    expect(result.cursorPosition).toBeGreaterThanOrEqual(5);
  });

  it("deadReckonTyping returns original for zero time delta", () => {
    const result = deadReckonTyping("hello", 5, 0, 60);
    expect(result.code).toBe("hello");
    expect(result.cursorPosition).toBe(5);
  });
});

describe("Network Quality Utilities", () => {
  it("getNetworkQualityColor returns correct colors", () => {
    expect(getNetworkQualityColor("excellent")).toBe("text-emerald-400");
    expect(getNetworkQualityColor("good")).toBe("text-cyan-400");
    expect(getNetworkQualityColor("fair")).toBe("text-amber-400");
    expect(getNetworkQualityColor("poor")).toBe("text-rose-400");
  });

  it("getNetworkQualityLabel returns correct labels", () => {
    expect(getNetworkQualityLabel("excellent")).toBe("Excellent");
    expect(getNetworkQualityLabel("good")).toBe("Good");
    expect(getNetworkQualityLabel("fair")).toBe("Fair");
    expect(getNetworkQualityLabel("poor")).toBe("Poor");
  });
});