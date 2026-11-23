import { describe, it, expect } from 'vitest';
import { MultiAgentReviewerService } from './pr-reviewer.service';

describe('MultiAgentReviewerService (Vitest Webhook Payload Simulation)', () => {
  it('approves clean PR diffs across Security, Performance, and Clean-Code agents', async () => {
    const reviewer = new MultiAgentReviewerService();
    const out = await reviewer.reviewPullRequestWebhook({
      eventAction: 'opened',
      prNumber: 777,
      authorLogin: 'Itssonia7',
      labels: ['nsoc26'],
      diffContent: [
        '+++ b/src/clean.ts',
        '@@ -1,2 +1,3 @@',
        '+export function addNumbers(a: number, b: number): number {',
        '+  return a + b;',
        '+}',
      ].join('\n'),
      filesChanged: ['src/clean.ts'],
    });

    expect(out.skipped).toBe(false);
    expect(out.consensusDecision).toBe('APPROVED');
    expect(out.inlineSuggestions).toHaveLength(0);
  });
});
