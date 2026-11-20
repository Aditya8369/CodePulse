import { createHash } from 'crypto';
import { PowService, PowRedisLike } from './pow.service';

function solveLocally(challenge: string, difficulty: number): string {
  const prefix = '0'.repeat(difficulty);
  let nonce = 0;
  while (true) {
    const candidate = String(nonce);
    const hash = createHash('sha256')
      .update(`${challenge}${candidate}`)
      .digest('hex');
    if (hash.startsWith(prefix)) {
      return candidate;
    }
    nonce++;
  }
}

describe('PowService', () => {
  let service: PowService;

  beforeEach(() => {
    service = new PowService(undefined, {
      hmacSecret: 'unit-test-pow-secret-key-32bytes!!',
      normalDifficulty: 4,
      surgeDifficulty: 6,
      surgeThresholdPerMin: 5,
      challengeTtlSeconds: 180,
      disableRedis: true,
    });
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should generate a signed PoW challenge with normal difficulty (4 leading zeros)', () => {
    const puzzle = service.generateChallenge();

    expect(puzzle.algorithm).toBe('SHA-256');
    expect(puzzle.difficulty).toBe(4);
    expect(puzzle.targetPrefix).toBe('0000');
    expect(puzzle.ttlSeconds).toBe(180);
    expect(puzzle.surgeActive).toBe(false);
    expect(puzzle.challenge.split('.')).toHaveLength(5);
  });

  it('should dynamically escalate difficulty from 4 to 6 leading zeros during traffic surge', () => {
    expect(service.getCurrentDifficulty()).toBe(4);
    expect(service.isTrafficSurge()).toBe(false);

    // Simulate traffic surge reaching threshold (5 req/min in test config)
    const now = Date.now();
    service.recordTraffic(5, now);

    expect(service.isTrafficSurge(now)).toBe(true);
    expect(service.getCurrentDifficulty(now)).toBe(6);

    const surgePuzzle = service.generateChallenge(now);
    expect(surgePuzzle.difficulty).toBe(6);
    expect(surgePuzzle.targetPrefix).toBe('000000');
    expect(surgePuzzle.surgeActive).toBe(true);

    // After 61 seconds, traffic window slides and difficulty returns to 4
    expect(service.getCurrentDifficulty(now + 61_000)).toBe(4);
  });

  it('should verify a valid nonce solution in < 1ms on the server', async () => {
    const puzzle = service.generateChallenge();
    const nonce = solveLocally(puzzle.challenge, puzzle.difficulty);

    const result = await service.verifySolution(puzzle.challenge, nonce);

    expect(result.valid).toBe(true);
    expect(result.challengeId).toBe(puzzle.challengeId);
    expect(result.difficulty).toBe(4);
    expect(result.hash?.startsWith('0000')).toBe(true);
    expect(result.verificationTimeMs).toBeLessThan(5);

    // Average verification latency across 50 warm checks should be well under 1ms
    const warmSamples: number[] = [];
    for (let i = 0; i < 50; i++) {
      const p = service.generateChallenge();
      const n = solveLocally(p.challenge, p.difficulty);
      const res = await service.verifySolution(p.challenge, n);
      expect(res.valid).toBe(true);
      warmSamples.push(res.verificationTimeMs);
    }
    const avgMs =
      warmSamples.reduce((acc, v) => acc + v, 0) / warmSamples.length;
    expect(avgMs).toBeLessThan(1);
  });

  it('should reject an incorrect nonce that does not produce required leading zeros', async () => {
    const puzzle = service.generateChallenge();
    const result = await service.verifySolution(
      puzzle.challenge,
      'invalid-nonce-999999999',
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('leading zeros');
  });

  it('should reject tampered challenge difficulty via HMAC signature check', async () => {
    const puzzle = service.generateChallenge();
    const parts = puzzle.challenge.split('.');
    // Attempt to downgrade difficulty from 4 to 1
    parts[3] = '1';
    const tamperedChallenge = parts.join('.');
    const easyNonce = solveLocally(tamperedChallenge, 1);

    const result = await service.verifySolution(tamperedChallenge, easyNonce);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('HMAC signature');
  });

  it('should reject expired challenges past their 3-minute TTL', async () => {
    const issuedAt = Date.now() - 200_000;
    const puzzle = service.generateChallenge(issuedAt);
    const nonce = solveLocally(puzzle.challenge, puzzle.difficulty);

    const result = await service.verifySolution(
      puzzle.challenge,
      nonce,
      Date.now(),
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('should block replay attacks within the 3-minute (180s) expiration window', async () => {
    const puzzle = service.generateChallenge();
    const nonce = solveLocally(puzzle.challenge, puzzle.difficulty);

    const firstAttempt = await service.verifySolution(puzzle.challenge, nonce);
    expect(firstAttempt.valid).toBe(true);

    // Immediate replay with the exact same challenge and nonce must be blocked
    const replayAttempt = await service.verifySolution(puzzle.challenge, nonce);
    expect(replayAttempt.valid).toBe(false);
    expect(replayAttempt.reason).toContain('replay attack blocked');
  });

  it('should use atomic Redis SET EX 180 NX when Redis client is connected', async () => {
    const store = new Map<string, { val: string; ttl: number }>();
    const mockRedis: PowRedisLike = {
      status: 'ready',
      set: jest.fn(async (key, val, _ex, ttl, _nx) => {
        if (store.has(key)) return null;
        store.set(key, { val, ttl });
        return 'OK';
      }),
      exists: jest.fn(async (key) => (store.has(key) ? 1 : 0)),
      disconnect: jest.fn(),
    };

    service.setRedisClient(mockRedis);

    const puzzle = service.generateChallenge();
    const nonce = solveLocally(puzzle.challenge, puzzle.difficulty);

    const first = await service.verifySolution(puzzle.challenge, nonce);
    expect(first.valid).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledWith(
      `pow:replay:${puzzle.challengeId}`,
      nonce,
      'EX',
      180,
      'NX',
    );

    const replay = await service.verifySolution(puzzle.challenge, nonce);
    expect(replay.valid).toBe(false);
    expect(replay.reason).toContain('replay attack blocked');
  });
});
