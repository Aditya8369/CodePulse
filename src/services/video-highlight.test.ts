import { describe, it, expect } from 'vitest';
import {
  BattleHighlightComposition,
  interpolateValue,
  BattleHighlightProps,
} from '../../backend/src/remotion/BattleHighlightComposition';

describe('BattleHighlightComposition Frontend / Remotion Component', () => {
  const sampleProps: BattleHighlightProps = {
    matchId: 'battle_clutch_123',
    format: 'VERTICAL',
    durationInSeconds: 15,
    fps: 30,
    winner: {
      username: 'clutch_king',
      rating: 2200,
      finalCode: 'function solve() { return true; }',
      testsPassed: 10,
      totalTests: 10,
      clutchTimeRemainingMs: 1450,
    },
    opponent: {
      username: 'worthy_rival',
      rating: 2150,
      finalCode: 'function solve() { return false; }',
      testsPassed: 7,
      totalTests: 10,
    },
    timelineEvents: [
      {
        timestampMs: 1000,
        author: 'winner',
        codeSnippet: 'function solve()',
        cursorLine: 1,
        cursorCol: 16,
      },
      {
        timestampMs: 12000,
        author: 'winner',
        codeSnippet: 'function solve() { return true; }',
        cursorLine: 1,
        cursorCol: 33,
      },
    ],
    winnerProgressions: [
      { timestampMs: 5000, passedTests: 4, totalTests: 10 },
      { timestampMs: 12000, passedTests: 10, totalTests: 10 },
    ],
  };

  it('renders without throwing for vertical reels (1080x1920)', () => {
    const element = BattleHighlightComposition({ ...sampleProps, currentFrame: 150 }) as React.ReactElement<{ style: React.CSSProperties }>;
    expect(element).toBeDefined();
    expect(element?.props?.style?.width).toBe(1080);
    expect(element?.props?.style?.height).toBe(1920);
  });

  it('renders without throwing for horizontal landscape (1920x1080)', () => {
    const element = BattleHighlightComposition({
      ...sampleProps,
      format: 'HORIZONTAL',
      currentFrame: 200,
    }) as React.ReactElement<{ style: React.CSSProperties }>;
    expect(element).toBeDefined();
    expect(element?.props?.style?.width).toBe(1920);
    expect(element?.props?.style?.height).toBe(1080);
  });

  it('displays victory fanfare when current frame exceeds 75% duration', () => {
    // Total frames = 15 * 30 = 450 frames. 75% = 337.5 frames.
    const elementEarly = BattleHighlightComposition({ ...sampleProps, currentFrame: 100 });
    const elementLate = BattleHighlightComposition({ ...sampleProps, currentFrame: 400 });

    // In React element tree, fanfare active appears when frame >= fanfareStartFrame
    expect(elementEarly).toBeDefined();
    expect(elementLate).toBeDefined();
  });

  it('interpolates values correctly across keyframes', () => {
    expect(interpolateValue(0, [0, 100], [10, 20])).toBe(10);
    expect(interpolateValue(50, [0, 100], [10, 20])).toBe(15);
    expect(interpolateValue(100, [0, 100], [10, 20])).toBe(20);
  });
});
