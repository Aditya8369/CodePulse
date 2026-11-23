import { describe, it, expect } from "vitest";
import { ArchitecturalDriftService } from "../../backend/src/modules/analytics/architectural-drift.service";

describe("ArchitecturalDriftService (Vitest Cycle & Rule Verification)", () => {
  it("enforces architectural rules and outputs red Mermaid.js edges for violated imports", () => {
    const svc = new ArchitecturalDriftService();
    const report = svc.analyzeArchitecture([
      {
        filePath: "backend/src/modules/billing/billing.controller.ts",
        content: [
          "import { Controller } from '@nestjs/common';",
          "import { BillingRepository } from './billing.repository';",
          "export class BillingController {}",
        ].join("\n"),
      },
      {
        filePath: "backend/src/modules/billing/billing.repository.ts",
        content: "export class BillingRepository {}",
      },
    ]);

    expect(report.boundaryViolations).toHaveLength(1);
    expect(report.boundaryViolations[0].lineNumber).toBe(2);
    expect(report.mermaidGraph).toContain("stroke:#ef4444");
    expect(report.driftIndexPercent).toBeGreaterThan(0);
  });
});
