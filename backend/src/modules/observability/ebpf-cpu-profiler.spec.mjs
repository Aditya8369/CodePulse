import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class EbpfCPUProfilerService {
  constructor() { this.s = []; }
  recordSample(stack) {
    const k = stack.join(';');
    const ex = this.s.find(item => item.stack.join(';') === k);
    if (ex) ex.count++;
    else this.s.push({ stack, count: 1 });
  }
  generateFlameGraphSummary() { return this.s.map(i => ({ stack: i.stack.join(';'), value: i.count })); }
}

describe('EbpfCPUProfilerService (Issue #1900)', () => {
  it('should aggregate sampled call stacks into folded flame graph structures', () => {
    const profiler = new EbpfCPUProfilerService();
    profiler.recordSample(['main', 'solveChallenge', 'evalAST']);
    profiler.recordSample(['main', 'solveChallenge', 'evalAST']);
    profiler.recordSample(['main', 'healthCheck']);

    const summary = profiler.generateFlameGraphSummary();
    assert.equal(summary.find(s => s.stack.includes('evalAST'))?.value, 2);
    assert.equal(summary.find(s => s.stack.includes('healthCheck'))?.value, 1);
  });
});
