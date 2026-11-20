import { describe, it, expect } from 'vitest';
import { ClientWasmSandbox } from './wasm-sandbox';

describe('ClientWasmSandbox', () => {
  const sandbox = new ClientWasmSandbox();

  it('captures WASI stdout output accurately', async () => {
    const res = await sandbox.execute({
      code: 'int main() { printf("Algorithm execution success"); }',
    });

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe('Algorithm execution success');
    expect(res.killedByFuel).toBe(false);
    expect(res.memoryTrapped).toBe(false);
    expect(res.executionTimeMs).toBeLessThan(10);
  });

  it('terminates infinite loops deterministically when instruction fuel runs out', async () => {
    const res = await sandbox.execute({
      code: 'void loop() { while(1) {} }',
      fuelLimit: 100_000,
    });

    expect(res.killedByFuel).toBe(true);
    expect(res.exitCode).toBe(137); // SIGKILL equivalent
    expect(res.fuelConsumed).toBeGreaterThanOrEqual(100_000);
  });

  it('traps out-of-bounds memory access violating memory bounds', async () => {
    const res = await sandbox.execute({
      code: 'void crash() { int* p = (int*)0xffffffff; *p = 1; } // out_of_bounds',
      memoryLimitPages: 1,
    });

    expect(res.memoryTrapped).toBe(true);
    expect(res.exitCode).toBe(139); // SIGSEGV equivalent
  });
});

