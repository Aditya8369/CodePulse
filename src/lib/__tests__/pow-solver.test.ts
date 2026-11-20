import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  buildPowWasmModule,
  fetchWithPow,
  solvePowChallenge,
  wasmSha256Hex,
} from '../pow-solver';

function nodeSha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

describe('WebAssembly SHA-256 PoW Solver Library', () => {
  it('produces a valid WebAssembly binary module', () => {
    const wasmBytes = buildPowWasmModule();
    expect(wasmBytes[0]).toBe(0x00);
    expect(wasmBytes[1]).toBe(0x61);
    expect(wasmBytes[2]).toBe(0x73);
    expect(wasmBytes[3]).toBe(0x6d);
    expect(WebAssembly.validate(wasmBytes as unknown as BufferSource)).toBe(
      true,
    );
  });

  it('computes exact FIPS 180-4 SHA-256 digests across single-block and multi-block inputs', async () => {
    const vectors = [
      '',
      'abc',
      'codepulse-pow-test-vector',
      // 56-byte boundary case requiring two 64-byte padding blocks
      'a'.repeat(56),
      // Multi-block input (> 128 bytes)
      'a1b2c3d4e5f60718293a4b5c6d7e8f90.1731910000000.1731910180000.4.abcdef0123456789abcdef0123456789:1048576',
    ];

    for (const input of vectors) {
      const wasmDigest = await wasmSha256Hex(input);
      expect(wasmDigest).toBe(nodeSha256Hex(input));
    }
  });

  it('solves difficulty-4 challenges in WebAssembly within latency budget (< 200ms)', async () => {
    const challenge =
      '9f86d081884c7d659a2feaa0c55ad015.1731910000000.1731910180000.4.1234567890abcdef1234567890abcdef';
    const result = await solvePowChallenge(challenge, 4);

    expect(result.engine).toBe('wasm');
    expect(result.hash.startsWith('0000')).toBe(true);
    expect(result.hash).toBe(nodeSha256Hex(`${challenge}${result.nonce}`));
    expect(result.durationMs).toBeLessThan(200);
  });

  it('automatically intercepts HTTP 428 PoW challenges in fetchWithPow and retries with valid headers', async () => {
    const challenge =
      '0123456789abcdef0123456789abcdef.1731910000000.1731910180000.4.fedcba9876543210fedcba9876543210';
    let callCount = 0;

    const mockFetch: typeof fetch = async (_input, init) => {
      callCount++;
      const headers = new Headers(init?.headers);
      const sentChallenge = headers.get('x-pow-challenge');
      const sentNonce = headers.get('x-pow-nonce');

      if (!sentChallenge || !sentNonce) {
        return new Response(
          JSON.stringify({
            statusCode: 428,
            pow: { challenge, difficulty: 4 },
          }),
          { status: 428, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const digest = nodeSha256Hex(`${sentChallenge}${sentNonce}`);
      if (!digest.startsWith('0000')) {
        return new Response(JSON.stringify({ error: 'bad nonce' }), {
          status: 403,
        });
      }

      return new Response(JSON.stringify({ ok: true, nonce: sentNonce }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const response = await fetchWithPow(
      'http://localhost:3001/api/v1/auth/register',
      { method: 'POST' },
      mockFetch,
    );

    expect(callCount).toBe(2);
    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; nonce: string };
    expect(json.ok).toBe(true);
  });
});
