import { LspDaemonService } from './lsp-daemon.service';

describe('LspDaemonService (Cloud LSP Language Server Protocol Pool)', () => {
  let service: LspDaemonService;

  beforeEach(() => {
    service = new LspDaemonService();
    service.onModuleInit();
  });

  afterEach(() => {
    service.onApplicationShutdown();
  });

  it('initializes a new LSP session and returns capabilities', async () => {
    const res = await service.handleMessage('session-1', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { languageId: 'typescript', userId: 'user-dev' },
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(1);
    const result = res.result as { capabilities: { completionProvider: unknown; hoverProvider: boolean } };
    expect(result.capabilities.hoverProvider).toBe(true);
    expect(result.capabilities.completionProvider).toBeDefined();
    expect(service.getActiveSessionsCount()).toBe(1);
  });

  it('updates document text on textDocument/didOpen and textDocument/didChange', async () => {
    await service.handleMessage('session-1', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { languageId: 'typescript' },
    });

    await service.handleMessage('session-1', {
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: {
          uri: 'inmemory://session-1/main.ts',
          languageId: 'typescript',
          text: 'function addNumbers(a: number, b: number) { return a + b; }',
          version: 1,
        },
      },
    });

    const completionRes = await service.handleMessage('session-1', {
      jsonrpc: '2.0',
      id: 2,
      method: 'textDocument/completion',
      params: { position: { line: 0, character: 10 } },
    });

    const items = (completionRes.result as { items: Array<{ label: string }> }).items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.label === 'addNumbers')).toBe(true);
    expect(items.some((i) => i.label === 'Array.from')).toBe(true);
  });

  it('provides hover documentation for target line', async () => {
    await service.handleMessage('session-2', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { languageId: 'python' },
    });

    await service.handleMessage('session-2', {
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: {
          uri: 'inmemory://session-2/main.py',
          languageId: 'python',
          text: 'def compute_primes(limit):\n    return []',
          version: 1,
        },
      },
    });

    const hoverRes = await service.handleMessage('session-2', {
      jsonrpc: '2.0',
      id: 3,
      method: 'textDocument/hover',
      params: { position: { line: 0, character: 5 } },
    });

    const hover = hoverRes.result as { contents: { value: string } };
    expect(hover.contents.value).toContain('compute_primes');
    expect(hover.contents.value).toContain('Function Definition');
  });

  it('automatically collects idle sessions after inactivity timeout', () => {
    service.handleMessage('session-idle', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { languageId: 'cpp' },
    });

    expect(service.getActiveSessionsCount()).toBe(1);

    // Simulate GC with threshold 0 to purge all idle sessions
    const purged = service.collectIdleSessions(-1);
    expect(purged).toBe(1);
    expect(service.getActiveSessionsCount()).toBe(0);
  });
});
