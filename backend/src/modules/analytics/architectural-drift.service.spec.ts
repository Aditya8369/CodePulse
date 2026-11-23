import { ArchitecturalDriftService } from './architectural-drift.service';

describe('ArchitecturalDriftService (Johnson Cycles, Boundary Rules, Mermaid & PR Gate)', () => {
  let service: ArchitecturalDriftService;

  beforeEach(() => {
    service = new ArchitecturalDriftService();
  });

  it('detects circular dependencies, flags exact file/line boundary violations, generates red Mermaid links, and blocks offending PRs', () => {
    const baseFiles = [
      {
        filePath: 'backend/src/modules/orders/orders.controller.ts',
        content: `import { Injectable } from '@nestjs/common';\nimport { OrdersService } from './orders.service';\nexport class OrdersController {}`,
      },
      {
        filePath: 'backend/src/modules/orders/orders.service.ts',
        content: `import { Injectable } from '@nestjs/common';\nexport class OrdersService {}`,
      },
      {
        filePath: 'backend/src/prisma/prisma.service.ts',
        content: `export class PrismaService {}`,
      },
    ];

    const headFiles = [
      {
        filePath: 'backend/src/modules/orders/orders.controller.ts',
        content: `import { Injectable } from '@nestjs/common';\nimport { OrdersService } from './orders.service';\nimport { PrismaService } from '../../prisma/prisma.service';\nexport class OrdersController {}`,
      },
      {
        filePath: 'backend/src/modules/orders/orders.service.ts',
        content: `import { OrdersController } from './orders.controller';\nexport class OrdersService {}`,
      },
      {
        filePath: 'backend/src/prisma/prisma.service.ts',
        content: `export class PrismaService {}`,
      },
    ];

    const gate = service.evaluatePullRequestGate(baseFiles, headFiles);

    expect(gate.blocked).toBe(true);
    expect(gate.passed).toBe(false);
    expect(gate.newCircularCycles).toHaveLength(1);
    expect(gate.newCircularCycles[0].path).toEqual([
      'backend/src/modules/orders/orders.controller.ts',
      'backend/src/modules/orders/orders.service.ts',
      'backend/src/modules/orders/orders.controller.ts',
    ]);

    expect(gate.newBoundaryViolations).toHaveLength(1);
    expect(gate.newBoundaryViolations[0].sourceFile).toBe(
      'backend/src/modules/orders/orders.controller.ts',
    );
    expect(gate.newBoundaryViolations[0].lineNumber).toBe(3);

    expect(gate.mermaidGraph).toContain('graph TD');
    expect(gate.mermaidGraph).toContain('stroke:#ef4444');
    expect(gate.headDriftIndexPercent).toBeGreaterThan(0);
  });

  it('scales Johnson cycle detection across 2,500 files in under 2 seconds', () => {
    const files = Array.from({ length: 2500 }, (_, i) => {
      const next = i < 2499 ? `./mod-${i + 1}` : './mod-2495'; // 5-node cycle at tail
      return {
        filePath: `src/mod-${i}.ts`,
        content: `import { x } from '${next}';\nexport const v = ${i};`,
      };
    });

    const report = service.analyzeArchitecture(files, []);
    expect(report.totalFiles).toBe(2500);
    expect(report.circularCycles).toHaveLength(1);
    expect(report.circularCycles[0].length).toBe(5);
    expect(report.executionTimeMs).toBeLessThan(2000);
  });
});
