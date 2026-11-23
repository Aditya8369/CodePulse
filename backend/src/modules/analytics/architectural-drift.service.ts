import { Injectable } from '@nestjs/common';
import * as path from 'path';
import {
  ArchitecturalDriftReport,
  ArchitecturalRuleDto,
  BoundaryViolationFinding,
  CircularCycleFinding,
  PrArchitecturalGateResult,
  SourceFileNodeDto,
} from './dto/arch-rules.dto';

export interface ImportEdge {
  from: string;
  to: string;
  specifier: string;
  lineNumber: number;
}

export interface DependencyGraph {
  nodes: string[];
  edges: ImportEdge[];
  adjacency: Map<string, ImportEdge[]>;
}

export const DEFAULT_ARCHITECTURAL_RULES: ArchitecturalRuleDto[] = [
  {
    id: 'ARCH-001',
    description: 'Controllers must not import Prisma or Repository persistence layers directly',
    fromPattern: '\\.controller\\.ts$',
    targetPattern: '(prisma\\.service|\\.repository)\\.ts$',
    mode: 'FORBID_IMPORT',
  },
  {
    id: 'ARCH-002',
    description: 'Domain/backend services must not import frontend UI components',
    fromPattern: '^backend/src/',
    targetPattern: '^src/components/',
    mode: 'FORBID_IMPORT',
  },
  {
    id: 'ARCH-003',
    description: 'Common shared utilities must not depend on feature modules',
    fromPattern: '^backend/src/common/',
    targetPattern: '^backend/src/modules/',
    mode: 'FORBID_IMPORT',
  },
];

@Injectable()
export class ArchitecturalDriftService {
  private normalizeFilePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  private resolveRelativeImport(
    fromFile: string,
    specifier: string,
    knownFiles: Set<string>,
  ): string | null {
    if (!specifier.startsWith('.')) {
      // Check workspace alias or direct project path match
      const cleanSpec = this.normalizeFilePath(specifier);
      const candidates = [
        cleanSpec,
        `${cleanSpec}.ts`,
        `${cleanSpec}.tsx`,
        `${cleanSpec}/index.ts`,
      ];
      for (const c of candidates) {
        if (knownFiles.has(c)) return c;
      }
      return null;
    }

    const dir = path.posix.dirname(fromFile);
    const resolvedBase = this.normalizeFilePath(path.posix.normalize(path.posix.join(dir, specifier)));
    const candidates = [
      resolvedBase,
      `${resolvedBase}.ts`,
      `${resolvedBase}.tsx`,
      `${resolvedBase}.js`,
      `${resolvedBase}/index.ts`,
      `${resolvedBase}/index.tsx`,
    ];

    for (const candidate of candidates) {
      if (knownFiles.has(candidate)) {
        return candidate;
      }
    }
    // Preserve normalized target even if external to provided subset so boundary rules can inspect path
    return `${resolvedBase}.ts`;
  }

  /**
   * Parses TypeScript import/re-export statements with 1-based line numbers
   * and constructs a directed module dependency graph.
   */
  buildDependencyGraph(files: SourceFileNodeDto[]): DependencyGraph {
    const normalizedFiles = files.map((f) => ({
      filePath: this.normalizeFilePath(f.filePath),
      content: f.content,
    }));

    const knownFiles = new Set<string>(normalizedFiles.map((f) => f.filePath));
    const adjacency = new Map<string, ImportEdge[]>();
    for (const f of normalizedFiles) {
      adjacency.set(f.filePath, []);
    }

    const edges: ImportEdge[] = [];
    const importRegex =
      /(?:^\s*import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?|^\s*export\s+(?:type\s+)?[\s\S]*?\s+from\s+|import\s*\()\s*['"]([^'"]+)['"]/gm;

    for (const file of normalizedFiles) {
      const lines = file.content.split('\n');
      const lineStartOffsets: number[] = [0];
      for (let i = 0; i < lines.length; i++) {
        lineStartOffsets.push(lineStartOffsets[i] + lines[i].length + 1);
      }

      const findLineNumber = (charIndex: number): number => {
        let lo = 0;
        let hi = lineStartOffsets.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (lineStartOffsets[mid] <= charIndex) lo = mid;
          else hi = mid - 1;
        }
        return lo + 1;
      };

      importRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(file.content)) !== null) {
        const specifier = match[1];
        const target = this.resolveRelativeImport(file.filePath, specifier, knownFiles);
        if (!target || target === file.filePath) continue;

        const edge: ImportEdge = {
          from: file.filePath,
          to: target,
          specifier,
          lineNumber: findLineNumber(match.index),
        };
        edges.push(edge);
        adjacency.get(file.filePath)?.push(edge);
      }
    }

    return {
      nodes: Array.from(knownFiles),
      edges,
      adjacency,
    };
  }

  /**
   * Johnson's Elementary Cycle-Finding Algorithm with Tarjan SCC decomposition.
   * Finds all elementary directed cycles in O((V + E)(C + 1)) time, processing
   * thousands of TypeScript modules in milliseconds.
   */
  findCircularDependenciesJohnsons(
    graph: DependencyGraph,
    maxCycles = 250,
  ): CircularCycleFinding[] {
    const nodes = [...graph.nodes].sort();
    const n = nodes.length;
    if (n === 0) return [];

    const nodeIndex = new Map<string, number>();
    nodes.forEach((id, idx) => nodeIndex.set(id, idx));

    const adj: number[][] = Array.from({ length: n }, () => []);
    for (const edge of graph.edges) {
      const u = nodeIndex.get(edge.from);
      const v = nodeIndex.get(edge.to);
      if (u !== undefined && v !== undefined && u !== v) {
        if (!adj[u].includes(v)) adj[u].push(v);
      }
    }
    for (let i = 0; i < n; i++) adj[i].sort((a, b) => a - b);

    const cycles: CircularCycleFinding[] = [];
    const blocked = new Uint8Array(n);
    const blockMap: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
    const stack: number[] = [];

    const unblock = (u: number) => {
      blocked[u] = 0;
      for (const w of blockMap[u]) {
        blockMap[u].delete(w);
        if (blocked[w]) unblock(w);
      }
    };

    // Tarjan's Strongly Connected Components on subgraph induced by vertices >= startIdx
    const findLeastVertexScc = (startIdx: number): { leastVertex: number; sccSet: Set<number> } | null => {
      let indexCounter = 0;
      const indices = new Int32Array(n).fill(-1);
      const lowlink = new Int32Array(n).fill(-1);
      const onStack = new Uint8Array(n);
      const tarjanStack: number[] = [];
      let bestScc: Set<number> | null = null;
      let bestLeast = n;

      const strongConnect = (v: number) => {
        indices[v] = indexCounter;
        lowlink[v] = indexCounter;
        indexCounter += 1;
        tarjanStack.push(v);
        onStack[v] = 1;

        for (const w of adj[v]) {
          if (w < startIdx) continue;
          if (indices[w] === -1) {
            strongConnect(w);
            lowlink[v] = Math.min(lowlink[v], lowlink[w]);
          } else if (onStack[w]) {
            lowlink[v] = Math.min(lowlink[v], indices[w]);
          }
        }

        if (lowlink[v] === indices[v]) {
          const scc = new Set<number>();
          let least = n;
          let w: number;
          do {
            w = tarjanStack.pop()!;
            onStack[w] = 0;
            scc.add(w);
            if (w < least) least = w;
          } while (w !== v);

          if (scc.size > 1 && least < bestLeast) {
            bestLeast = least;
            bestScc = scc;
          }
        }
      };

      for (let v = startIdx; v < n; v++) {
        if (indices[v] === -1) {
          strongConnect(v);
        }
      }

      return bestScc ? { leastVertex: bestLeast, sccSet: bestScc } : null;
    };

    let s = 0;
    while (s < n && cycles.length < maxCycles) {
      const sccResult = findLeastVertexScc(s);
      if (!sccResult) break;

      const { leastVertex, sccSet } = sccResult;
      for (const v of sccSet) {
        blocked[v] = 0;
        blockMap[v].clear();
      }

      const circuit = (v: number): boolean => {
        if (cycles.length >= maxCycles) return false;
        let foundCycle = false;
        stack.push(v);
        blocked[v] = 1;

        for (const w of adj[v]) {
          if (!sccSet.has(w)) continue;
          if (w === leastVertex) {
            const cyclePath = [...stack.map((idx) => nodes[idx]), nodes[leastVertex]];
            cycles.push({
              cycleId: `CYCLE-${cycles.length + 1}`,
              path: cyclePath,
              length: cyclePath.length - 1,
            });
            foundCycle = true;
          } else if (!blocked[w]) {
            if (circuit(w)) foundCycle = true;
          }
        }

        if (foundCycle) {
          unblock(v);
        } else {
          for (const w of adj[v]) {
            if (sccSet.has(w)) blockMap[w].add(v);
          }
        }

        stack.pop();
        return foundCycle;
      };

      circuit(leastVertex);
      s = leastVertex + 1;
    }

    return cycles;
  }

  /**
   * Enforces customizable architectural boundary rules across all parsed import edges,
   * returning exact file paths and 1-based line numbers for every violation.
   */
  evaluateBoundaryRules(
    graph: DependencyGraph,
    rules: ArchitecturalRuleDto[] = DEFAULT_ARCHITECTURAL_RULES,
  ): BoundaryViolationFinding[] {
    const findings: BoundaryViolationFinding[] = [];
    const compiledRules = rules.map((r) => ({
      ...r,
      fromRegex: new RegExp(r.fromPattern),
      targetRegex: new RegExp(r.targetPattern),
      mode: r.mode ?? 'FORBID_IMPORT',
    }));

    for (const edge of graph.edges) {
      for (const rule of compiledRules) {
        if (!rule.fromRegex.test(edge.from)) continue;

        const targetMatches = rule.targetRegex.test(edge.to);
        const violated =
          rule.mode === 'FORBID_IMPORT' ? targetMatches : !targetMatches;

        if (violated) {
          findings.push({
            ruleId: rule.id,
            description: rule.description,
            sourceFile: edge.from,
            targetFile: edge.to,
            importSpecifier: edge.specifier,
            lineNumber: edge.lineNumber,
          });
        }
      }
    }

    return findings;
  }

  /**
   * Computes Architectural Drift Index (0 - 100%) reflecting proportion of edges/nodes
   * involved in boundary violations or circular dependency cycles.
   */
  computeDriftIndexPercent(
    graph: DependencyGraph,
    cycles: CircularCycleFinding[],
    violations: BoundaryViolationFinding[],
  ): number {
    if (graph.nodes.length === 0) return 0;

    const cyclicNodes = new Set<string>();
    for (const c of cycles) {
      for (const p of c.path) cyclicNodes.add(p);
    }

    const totalEdges = Math.max(1, graph.edges.length);
    const violationRatio = Math.min(1, violations.length / totalEdges);
    const cycleNodeRatio = Math.min(1, cyclicNodes.size / graph.nodes.length);

    const rawPercent = (violationRatio * 0.6 + cycleNodeRatio * 0.4) * 100;
    return Number(Math.min(100, Math.max(0, rawPercent)).toFixed(2));
  }

  /**
   * Generates a visual Mermaid.js dependency diagram highlighting violated
   * and circular dependency edges in red (#ef4444).
   */
  renderMermaidDependencyGraph(
    graph: DependencyGraph,
    cycles: CircularCycleFinding[],
    violations: BoundaryViolationFinding[],
  ): string {
    const idMap = new Map<string, string>();
    const sanitizeId = (file: string, idx: number) => `N${idx}`;
    graph.nodes.forEach((node, idx) => idMap.set(node, sanitizeId(node, idx)));

    const violatedEdgeKeys = new Set<string>();
    for (const v of violations) {
      violatedEdgeKeys.add(`${v.sourceFile}->${v.targetFile}`);
    }
    for (const c of cycles) {
      for (let i = 0; i < c.path.length - 1; i++) {
        violatedEdgeKeys.add(`${c.path[i]}->${c.path[i + 1]}`);
      }
    }

    const lines: string[] = ['graph TD'];
    for (const [file, nodeId] of idMap.entries()) {
      const label = path.posix.basename(file);
      lines.push(`  ${nodeId}["${label}"]`);
    }

    const redLinkIndices: number[] = [];
    let linkIdx = 0;

    for (const edge of graph.edges) {
      const fromId = idMap.get(edge.from);
      const toId = idMap.get(edge.to);
      if (!fromId || !toId) continue;

      const isViolated = violatedEdgeKeys.has(`${edge.from}->${edge.to}`);
      if (isViolated) {
        lines.push(`  ${fromId} -. "VIOLATION L${edge.lineNumber}" .-> ${toId}`);
        redLinkIndices.push(linkIdx);
      } else {
        lines.push(`  ${fromId} --> ${toId}`);
      }
      linkIdx += 1;
    }

    for (const idx of redLinkIndices) {
      lines.push(`  linkStyle ${idx} stroke:#ef4444,stroke-width:3px,color:#ef4444;`);
    }

    return lines.join('\n');
  }

  /**
   * Executes full architectural drift analysis across a repository file set.
   */
  analyzeArchitecture(
    files: SourceFileNodeDto[],
    rules: ArchitecturalRuleDto[] = DEFAULT_ARCHITECTURAL_RULES,
  ): ArchitecturalDriftReport {
    const t0 = performance.now();
    const graph = this.buildDependencyGraph(files);
    const circularCycles = this.findCircularDependenciesJohnsons(graph);
    const boundaryViolations = this.evaluateBoundaryRules(graph, rules);
    const driftIndexPercent = this.computeDriftIndexPercent(
      graph,
      circularCycles,
      boundaryViolations,
    );
    const mermaidGraph = this.renderMermaidDependencyGraph(
      graph,
      circularCycles,
      boundaryViolations,
    );
    const executionTimeMs = Number((performance.now() - t0).toFixed(2));

    return {
      totalFiles: graph.nodes.length,
      totalInternalEdges: graph.edges.length,
      executionTimeMs,
      driftIndexPercent,
      circularCycles,
      boundaryViolations,
      mermaidGraph,
    };
  }

  /**
   * PR gatekeeper check comparing base vs head branch files and blocking PRs
   * that introduce new circular dependencies or architectural boundary violations.
   */
  evaluatePullRequestGate(
    baseFiles: SourceFileNodeDto[],
    headFiles: SourceFileNodeDto[],
    rules: ArchitecturalRuleDto[] = DEFAULT_ARCHITECTURAL_RULES,
  ): PrArchitecturalGateResult {
    const baseReport = this.analyzeArchitecture(baseFiles, rules);
    const headReport = this.analyzeArchitecture(headFiles, rules);

    const baseCycleKeys = new Set(
      baseReport.circularCycles.map((c) => [...c.path.slice(0, -1)].sort().join('|')),
    );
    const newCircularCycles = headReport.circularCycles.filter(
      (c) => !baseCycleKeys.has([...c.path.slice(0, -1)].sort().join('|')),
    );

    const baseViolationKeys = new Set(
      baseReport.boundaryViolations.map(
        (v) => `${v.ruleId}:${v.sourceFile}->${v.targetFile}`,
      ),
    );
    const newBoundaryViolations = headReport.boundaryViolations.filter(
      (v) => !baseViolationKeys.has(`${v.ruleId}:${v.sourceFile}->${v.targetFile}`),
    );

    const blocked = newCircularCycles.length > 0 || newBoundaryViolations.length > 0;
    const driftDeltaPercent = Number(
      (headReport.driftIndexPercent - baseReport.driftIndexPercent).toFixed(2),
    );

    return {
      passed: !blocked,
      blocked,
      baselineDriftIndexPercent: baseReport.driftIndexPercent,
      headDriftIndexPercent: headReport.driftIndexPercent,
      driftDeltaPercent,
      newCircularCycles,
      newBoundaryViolations,
      summary: blocked
        ? `PR blocked: introduced ${newCircularCycles.length} new circular cycle(s) and ${newBoundaryViolations.length} boundary violation(s).`
        : 'Architectural check passed: 0 new cycles or boundary violations introduced.',
      mermaidGraph: headReport.mermaidGraph,
    };
  }
}
