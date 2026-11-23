import { describe, it, expect, beforeEach } from 'vitest';
import { MonacoLspClient } from './lsp-client';

describe('MonacoLspClient (LSP Protocol Client Adapter)', () => {
  let client: MonacoLspClient;

  beforeEach(() => {
    client = new MonacoLspClient('session-test-123');
    client.connect();
  });

  it('provides autocompletion items including standard library and local tokens', async () => {
    const code = `
      function calculateFibonacci(n: number): number {
        const localSequence = [0, 1];
        return n;
      }
    `;

    const items = await client.requestCompletions(code, { lineNumber: 3, column: 10 });
    expect(items.length).toBeGreaterThanOrEqual(4);

    const labels = items.map((i) => i.label);
    expect(labels).toContain('Array.from');
    expect(labels).toContain('calculateFibonacci');
    expect(labels).toContain('localSequence');
  });

  it('provides hover documentation for cursor line', async () => {
    const code = 'const maxVal = Math.max(10, 20);';
    const hover = await client.requestHover(code, { lineNumber: 1, column: 15 });

    expect(hover).not.toBeNull();
    expect(hover?.contents[0].value).toContain('Math.max');
    expect(hover?.range?.startLineNumber).toBe(1);
  });

  it('resolves Go-to-Definition location', async () => {
    const code = 'const result = solveProblem();';
    const def = await client.requestDefinition(code, { lineNumber: 1, column: 18 });

    expect(def.uri).toBeDefined();
    expect(def.range.startLineNumber).toBe(1);
  });

  it('debounces rapid document changes', async () => {
    let callCount = 0;
    client.notifyDocumentChange('code 1', 1, () => {
      callCount++;
    });
    client.notifyDocumentChange('code 2', 2, () => {
      callCount++;
    });
    client.notifyDocumentChange('code 3', 3, () => {
      callCount++;
    });

    expect(callCount).toBe(0); // Not called synchronously

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(callCount).toBe(1); // Debounced to single execution
  });
});
