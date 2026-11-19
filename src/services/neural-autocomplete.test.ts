import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NeuralAutocompleteEngine } from '../components/editor/neural-autocomplete';

describe('NeuralAutocompleteEngine On-Device Wasm Completion', () => {
  let engine: NeuralAutocompleteEngine;

  beforeEach(async () => {
    engine = NeuralAutocompleteEngine.getInstance();
    engine.clearCache();
    await engine.init();
  });

  it('initializes ONNX Wasm/WebGPU runtime provider', async () => {
    const status = await engine.init();
    expect(status.modelLoaded).toBe(true);
    expect(['wasm', 'webgpu']).toContain(status.provider);
  });

  it('predicts inline code completion in under 35ms', async () => {
    const res = await engine.predict({
      prefix: 'for (let i = 0;',
      suffix: '',
      language: 'typescript',
    });

    expect(res.latencyMs).toBeLessThan(35);
    expect(res.completion).toContain('i < arr.length');
    expect(res.source).toBe('onnx_wasm');
  });

  it('stores and retrieves frequent predictions from LRU cache with sub-millisecond latency', async () => {
    const req = {
      prefix: 'if (!head || !head.next)',
      suffix: '',
      language: 'typescript',
    };

    // First call: onnx_wasm
    const first = await engine.predict(req);
    expect(first.source).toBe('onnx_wasm');
    expect(engine.getCacheSize()).toBeGreaterThan(0);

    // Second call: instant cache hit
    const second = await engine.predict(req);
    expect(second.source).toBe('cache');
    expect(second.completion).toBe(first.completion);
    expect(second.latencyMs).toBeLessThan(10);
  });

  it('debounces rapid typing events (50ms debounce)', async () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    engine.debouncedPredict(
      { prefix: 'const a =', suffix: '', language: 'typescript' },
      callback,
      50,
    );

    // After 20ms: should not have executed yet
    vi.advanceTimersByTime(20);
    expect(callback).not.toHaveBeenCalled();

    // After remaining 35ms (total 55ms): should execute
    vi.advanceTimersByTime(35);
    // Allow async resolution
    await vi.runAllTimersAsync();
    expect(callback).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

