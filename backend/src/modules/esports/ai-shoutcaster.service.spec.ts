import { AiShoutcasterService } from './ai-shoutcaster.service';

describe('AiShoutcasterService (Live Esports Commentary & TTS Streaming)', () => {
  let service: AiShoutcasterService;

  beforeEach(() => {
    service = new AiShoutcasterService();
  });

  it('generates contextually accurate commentary with emotion tags for Hype Caster vs Technical Analyst styles', () => {
    const hypeScript = service.generateCommentaryScript({
      battleId: 'battle-101',
      eventType: 'optimization_breakthrough',
      actorUsername: 'Player A',
      opponentUsername: 'Player B',
      complexityBefore: 'O(N^2)',
      complexityAfter: 'O(N)',
      style: 'HYPE_CASTER',
    });

    expect(hypeScript.emotion).toBe('Hype');
    expect(hypeScript.text).toContain('Player A');
    expect(hypeScript.text).toContain('O(N)');

    const analystScript = service.generateCommentaryScript({
      battleId: 'battle-101',
      eventType: 'optimization_breakthrough',
      actorUsername: 'Player A',
      opponentUsername: 'Player B',
      complexityBefore: 'O(N^2)',
      complexityAfter: 'O(N)',
      style: 'TECHNICAL_ANALYST',
    });

    expect(analystScript.emotion).toBe('Hype');
    expect(analystScript.text).toContain('asymptotic runtime');
    expect(analystScript.text).toContain('O(N^2)');
  });

  it('synthesizes streaming TTS audio chunks with latency well under 800ms', async () => {
    const result = await service.processMatchEvent({
      battleId: 'battle-202',
      eventType: 'score_lead_change',
      actorUsername: 'sonia',
      opponentUsername: 'alex',
      actorScore: 100,
      opponentScore: 85,
      timestampMs: 100_000,
    });

    expect(result.throttled).toBe(false);
    expect(result.totalLatencyMs).toBeLessThan(800);
    expect(result.chunks.length).toBeGreaterThanOrEqual(1);
    expect(result.chunks[result.chunks.length - 1].isFinal).toBe(true);
    expect(result.chunks[0].emotion).toBe('Climax');

    // Verify reconstructed WAV header starts with RIFF
    const merged = Buffer.concat(
      result.chunks.map((c) => Buffer.from(c.audioBase64, 'base64')),
    );
    expect(merged.subarray(0, 4).toString('ascii')).toBe('RIFF');
  });

  it('enforces adaptive commentary throttling to prevent overlapping speech during rapid event bursts', async () => {
    const first = await service.processMatchEvent({
      battleId: 'battle-303',
      eventType: 'fast_typing_burst',
      actorUsername: 'sonia',
      wpm: 120,
      timestampMs: 50_000,
    });
    expect(first.throttled).toBe(false);

    // Immediate follow-up event 400ms later while shoutcaster is still speaking must be throttled
    const second = await service.processMatchEvent({
      battleId: 'battle-303',
      eventType: 'failing_test_cases',
      actorUsername: 'sonia',
      passedTests: 2,
      totalTests: 5,
      timestampMs: 50_400,
    });
    expect(second.throttled).toBe(true);
    expect(second.chunks).toHaveLength(0);
  });
});
