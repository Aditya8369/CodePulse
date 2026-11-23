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

  describe('Multi-Tone Play-by-Play Commentary & Battle Event Ingestion (#1090)', () => {
    it('generates humorous commentary when in COMEDIC tone', () => {
      const comedicSabotage = service.generateCommentaryScript({
        battleId: 'battle-404',
        eventType: 'sabotage_used',
        actorUsername: 'alice',
        opponentUsername: 'bob',
        sabotageName: 'Reverse Editor',
        style: 'COMEDIC',
      });

      expect(comedicSabotage.emotion).toBe('Humorous');
      expect(comedicSabotage.text).toContain('alice');
      expect(comedicSabotage.text).toContain('Reverse Editor');

      const comedicError = service.generateCommentaryScript({
        battleId: 'battle-404',
        eventType: 'compilation_error',
        actorUsername: 'charlie',
        style: 'COMEDIC',
      });

      expect(comedicError.text).toContain('compiler');
      expect(comedicError.text).toContain('Semicolons');
    });

    it('generates energetic play-by-play for sabotage and passing tests in HYPE style', () => {
      const hypeSabotage = service.generateCommentaryScript({
        battleId: 'battle-505',
        eventType: 'sabotage_used',
        actorUsername: 'neo',
        opponentUsername: 'morpheus',
        sabotageName: 'Key Jammer',
        style: 'HYPE',
      });

      expect(hypeSabotage.emotion).toBe('Suspense');
      expect(hypeSabotage.text).toContain('TACTICAL SABOTAGE');

      const hypePass = service.generateCommentaryScript({
        battleId: 'battle-505',
        eventType: 'test_case_pass',
        actorUsername: 'neo',
        style: 'HYPE',
      });

      expect(hypePass.emotion).toBe('Hype');
      expect(hypePass.text).toContain('GREEN LIGHT');
    });

    it('triggers play-by-play audio commentary synthesis well under 800ms acceptance criteria', async () => {
      const start = Date.now();
      const result = await service.processMatchEvent({
        battleId: 'battle-606',
        eventType: 'test_case_pass',
        actorUsername: 'speedy',
        passedTests: 10,
        totalTests: 10,
        style: 'HYPE',
        timestampMs: 200_000,
      });
      const elapsed = Date.now() - start;

      expect(result.throttled).toBe(false);
      expect(result.totalLatencyMs).toBeLessThan(800);
      expect(elapsed).toBeLessThan(800); // Triggers within 800ms
      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });
});
