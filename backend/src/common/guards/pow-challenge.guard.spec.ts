import { ExecutionContext, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { PowChallengeGuard, SKIP_POW_KEY } from './pow-challenge.guard';
import { PowService } from '../../modules/security/pow.service';

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

function createMockContext(
  headers: Record<string, string> = {},
  body: Record<string, unknown> = {},
): {
  context: ExecutionContext;
  request: Record<string, any>;
  responseHeaders: Record<string, string>;
} {
  const request: Record<string, any> = { headers, body };
  const responseHeaders: Record<string, string> = {};
  const response = {
    setHeader: jest.fn((k: string, v: string) => {
      responseHeaders[k] = v;
    }),
  };

  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  return { context, request, responseHeaders };
}

describe('PowChallengeGuard', () => {
  let powService: PowService;
  let guard: PowChallengeGuard;

  beforeEach(() => {
    powService = new PowService(undefined, {
      hmacSecret: 'guard-test-pow-secret-key-32bytes!',
      normalDifficulty: 4,
      surgeDifficulty: 6,
      surgeThresholdPerMin: 50,
      challengeTtlSeconds: 180,
      disableRedis: true,
    });
    guard = new PowChallengeGuard(powService);
  });

  afterEach(() => {
    powService.onModuleDestroy();
  });

  it('should reject requests missing PoW headers with HTTP 428 and attach a fresh challenge', async () => {
    const { context, responseHeaders } = createMockContext();

    let caught: unknown;
    try {
      await guard.canActivate(context);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(HttpException);
    const httpErr = caught as HttpException;
    expect(httpErr.getStatus()).toBe(HttpStatus.PRECONDITION_REQUIRED);

    const payload = httpErr.getResponse() as Record<string, any>;
    expect(payload.pow.challenge).toBeDefined();
    expect(payload.pow.difficulty).toBe(4);
    expect(responseHeaders['X-PoW-Challenge']).toBe(payload.pow.challenge);
    expect(responseHeaders['X-PoW-Difficulty']).toBe('4');
  });

  it('should allow requests with a valid solved PoW challenge and nonce', async () => {
    const puzzle = powService.generateChallenge();
    const nonce = solveLocally(puzzle.challenge, puzzle.difficulty);

    const { context, request } = createMockContext({
      'x-pow-challenge': puzzle.challenge,
      'x-pow-nonce': nonce,
    });

    const allowed = await guard.canActivate(context);
    expect(allowed).toBe(true);
    expect(request.powVerification).toBeDefined();
    expect(request.powVerification.valid).toBe(true);
    expect(request.powVerification.verificationTimeMs).toBeLessThan(5);
  });

  it('should reject invalid or replayed PoW solutions with HTTP 403 Forbidden', async () => {
    const puzzle = powService.generateChallenge();
    const nonce = solveLocally(puzzle.challenge, puzzle.difficulty);

    const first = createMockContext({
      'x-pow-challenge': puzzle.challenge,
      'x-pow-nonce': nonce,
    });
    expect(await guard.canActivate(first.context)).toBe(true);

    // Replay attempt with same headers
    const replay = createMockContext({
      'x-pow-challenge': puzzle.challenge,
      'x-pow-nonce': nonce,
    });
    await expect(guard.canActivate(replay.context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should bypass verification when @SkipPow() metadata is set on handler', async () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => key === SKIP_POW_KEY),
    } as unknown as Reflector;
    const guardWithReflector = new PowChallengeGuard(powService, reflector);

    const { context } = createMockContext();
    expect(await guardWithReflector.canActivate(context)).toBe(true);
  });
});
