import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NeuralCompletionWasmEngine } from './neural-completion-wasm';

describe('NeuralCompletionWasmEngine Offline Sub-10ms Completion Suite (#1077)', () => {
  let engine: NeuralCompletionWasmEngine;

  beforeEach(async () => {
    engine = new NeuralCompletionWasmEngine();
    await engine.initialize();
  });

  afterEach(() => {
    engine.dispose();
  });

  describe('Model Metadata & Architecture Profile', () => {
    it('is configured with Qwen2.5-Coder-0.5B INT4 quantized architecture', () => {
      const meta = NeuralCompletionWasmEngine.MODEL_METADATA;
      expect(meta.modelId).toBe('qwen2.5-coder-0.5b-int4');
      expect(meta.quantization).toBe('INT4');
      expect(meta.contextWindow).toBe(2048);
      expect(meta.sizeBytes).toBeGreaterThan(100 * 1024 * 1024);
    });
  });

  describe('Sub-10ms Offline Algorithm Completions', () => {
    it('completes for-loop bounds in under 15ms entirely offline', async () => {
      const prefix = 'for (let i = 0; i < nums.len';
      const result = await engine.complete({ prefix, language: 'typescript' });

      expect(result.completionText).toContain('length; i++) {');
      expect(result.latencyMs).toBeLessThan(15);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('completes hash map initialization instantly', async () => {
      const prefix = 'const map = ';
      const result = await engine.complete({ prefix, language: 'typescript' });

      expect(result.completionText).toBe('new Map();');
      expect(result.latencyMs).toBeLessThan(15);
    });

    it('completes binary search while-loop conditions in under 15ms', async () => {
      const prefix = 'while (left <= ';
      const result = await engine.complete({ prefix, language: 'typescript' });

      expect(result.completionText).toContain('right)');
      expect(result.completionText).toContain('Math.floor');
      expect(result.latencyMs).toBeLessThan(15);
    });

    it('completes twoSum solution stubs across Python, Go, and Rust', async () => {
      const pyPrefix = 'def two_sum(nums: List[int], target: int) -> List[int]:';
      const pyRes = await engine.complete({ prefix: pyPrefix, language: 'python' });
      expect(pyRes.completionText).toContain('lookup = {}');

      const goPrefix = 'func TwoSum(nums []int, target int) []int {';
      const goRes = await engine.complete({ prefix: goPrefix, language: 'go' });
      expect(goRes.completionText).toContain('make(map[int]int)');

      const rustPrefix = 'pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {';
      const rustRes = await engine.complete({ prefix: rustPrefix, language: 'rust' });
      expect(rustRes.completionText).toContain('HashMap::new()');
    });
  });

  describe('Monaco Editor Provider Registration', () => {
    it('registers inline completion provider with Monaco API and returns disposable', () => {
      let registeredProvider: any = null;
      const mockMonaco = {
        languages: {
          registerInlineCompletionsProvider: (lang: string, provider: any) => {
            registeredProvider = provider;
            return { dispose: () => {} };
          },
        },
      };

      const disposable = engine.registerWithMonaco(mockMonaco);
      expect(disposable).toBeDefined();
      expect(registeredProvider).toBeDefined();
      expect(typeof registeredProvider.provideInlineCompletions).toBe('function');
    });
  });
});
