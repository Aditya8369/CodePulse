import { MultiAgentReviewerService } from './pr-reviewer.service';

describe('MultiAgentReviewerService (Multi-Agent Consensus, Diff Suggestions, Guards & Rate Limit)', () => {
  let service: MultiAgentReviewerService;

  beforeEach(() => {
    service = new MultiAgentReviewerService();
  });

  it('parses unified diff, generates inline ```suggestion``` blocks across personas, and completes fast', async () => {
    const mockDiff = [
      '--- a/src/service.ts',
      '+++ b/src/service.ts',
      '@@ -10,4 +10,6 @@',
      ' export class DemoService {',
      '+  run(raw: any) {',
      '+    console.log(raw);',
      '+  }',
      ' }',
    ].join('\n');

    const res = await service.reviewPullRequestWebhook({
      eventAction: 'opened',
      prNumber: 519,
      authorLogin: 'Itssonia7',
      authorType: 'User',
      labels: ['nsoc26', 'level3'],
      diffContent: mockDiff,
      filesChanged: ['src/service.ts'],
    });

    expect(res.skipped).toBe(false);
    expect(res.consensusDecision).toBe('CHANGES_REQUESTED');
    expect(res.inlineSuggestions.length).toBeGreaterThan(0);
    expect(res.inlineSuggestions[0].suggestionBlock).toContain('```suggestion');
    expect(res.latencyMs).toBeLessThan(15_000);
  });

  it('skips bot accounts and [skip-ai] PRs, and enforces per-PR rate limiting', async () => {
    const botRes = await service.reviewPullRequestWebhook({
      eventAction: 'opened',
      prNumber: 901,
      authorLogin: 'dependabot[bot]',
      authorType: 'Bot',
      diffContent: '+console.log("bot");',
      filesChanged: ['src/index.ts'],
    });
    expect(botRes.skipped).toBe(true);
    expect(botRes.consensusDecision).toBe('SKIPPED');

    const skipLabelRes = await service.reviewPullRequestWebhook({
      eventAction: 'synchronize',
      prNumber: 902,
      authorLogin: 'Itssonia7',
      labels: ['[skip-ai]'],
      diffContent: '+console.log("skip");',
      filesChanged: ['src/index.ts'],
    });
    expect(skipLabelRes.skipped).toBe(true);

    // Rate limit test on PR #903 (max 3 per minute)
    for (let i = 0; i < 3; i++) {
      const ok = await service.reviewPullRequestWebhook({
        eventAction: 'synchronize',
        prNumber: 903,
        authorLogin: 'Itssonia7',
        diffContent: '+const x = 1;',
        filesChanged: ['src/x.ts'],
      });
      expect(ok.rateLimited).toBeFalsy();
    }
    const fourth = await service.reviewPullRequestWebhook({
      eventAction: 'synchronize',
      prNumber: 903,
      authorLogin: 'Itssonia7',
      diffContent: '+const x = 2;',
      filesChanged: ['src/x.ts'],
    });
    expect(fourth.rateLimited).toBe(true);
  });
});
