import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  RADAR_COMPETENCY_AXES,
  SkillRadarChart,
  computeRadarVertices,
} from "./skill-radar-chart";

describe("SkillRadarChart (12-Axis Polar Geometry & Interactive Hover Tooltips)", () => {
  it("computes 12 polar-to-Cartesian vertices and displays competency details on vertex hover", () => {
    const scores = {
      Algorithms: 92,
      Concurrency: 81,
      Frontend: 88,
      Security: 79,
      DevOps: 74,
      Cryptography: 70,
      Database: 85,
      Networking: 77,
      "Clean Code": 90,
      Performance: 89,
      Testing: 86,
      "System Design": 91,
    };

    const vertices = computeRadarVertices(scores);
    expect(vertices).toHaveLength(RADAR_COMPETENCY_AXES.length);
    // Axis 0 (Algorithms, score 92) is straight up (-90 deg): x == 200, y < 200
    expect(vertices[0].x).toBe(200);
    expect(vertices[0].y).toBeLessThan(200);

    render(<SkillRadarChart username="sonia" scores={scores} />);

    expect(screen.getByTestId("skill-radar-svg")).toBeDefined();
    expect(screen.getByTestId("radar-primary-polygon")).toBeDefined();

    fireEvent.mouseEnter(screen.getByTestId("radar-node-Algorithms"));
    expect(screen.getByTestId("radar-axis-tooltip").textContent).toContain("Algorithms");
    expect(screen.getByTestId("radar-axis-tooltip").textContent).toContain("92 / 100");
  });
});
