import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LiveActivityRadar } from "./live-activity-radar";

describe("LiveActivityRadar canvas responsiveness", () => {
  beforeEach(() => {
    // Mock getContext for HTMLCanvasElement in test environment
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      closePath: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
    });
  });

  it("renders canvas inside aspect-ratio locked container without squishing", () => {
    render(<LiveActivityRadar username="testuser" />);

    const container = screen.getByTestId("radar-chart-container");
    expect(container).toBeInTheDocument();

    const canvas = screen.getByTestId("radar-canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas.style.width).toBe(canvas.style.height);
  });

  it("renders detected signals feed cleanly", () => {
    render(<LiveActivityRadar username="octocat" />);
    expect(screen.getByText("Detected Signals")).toBeInTheDocument();
    expect(screen.getByText(/Opened Pull Request #204/i)).toBeInTheDocument();
  });
});
