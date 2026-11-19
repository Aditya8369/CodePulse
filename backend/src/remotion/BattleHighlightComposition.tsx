import React from 'react';

export interface CodeTypingEvent {
  timestampMs: number;
  author: 'winner' | 'opponent';
  codeSnippet: string;
  cursorLine: number;
  cursorCol: number;
}

export interface TestResultProgression {
  timestampMs: number;
  passedTests: number;
  totalTests: number;
}

export interface BattleHighlightProps {
  matchId: string;
  format: 'VERTICAL' | 'HORIZONTAL'; // VERTICAL = 1080x1920 (reels/shorts), HORIZONTAL = 1920x1080 (landscape)
  durationInSeconds: number; // typically 15s
  fps?: number; // default 30
  winner: {
    username: string;
    avatarUrl?: string;
    rating: number;
    finalCode: string;
    testsPassed: number;
    totalTests: number;
    clutchTimeRemainingMs: number; // e.g. 1800 ms remaining
  };
  opponent: {
    username: string;
    avatarUrl?: string;
    rating: number;
    finalCode: string;
    testsPassed: number;
    totalTests: number;
  };
  timelineEvents: CodeTypingEvent[];
  winnerProgressions: TestResultProgression[];
}

/**
 * Pure Remotion-compatible interpolation helper
 */
export function interpolateValue(
  frame: number,
  inputRange: [number, number],
  outputRange: [number, number],
): number {
  const [inMin, inMax] = inputRange;
  const [outMin, outMax] = outputRange;
  if (frame <= inMin) return outMin;
  if (frame >= inMax) return outMax;
  const progress = (frame - inMin) / (inMax - inMin);
  return outMin + progress * (outMax - outMin);
}

/**
 * BattleHighlightComposition
 * Author: CodePulse Esports Platform
 * Renders animated side-by-side code editors, countdown timer, player avatars,
 * test suite progression, and victory fanfare banner graphics.
 */
export const BattleHighlightComposition: React.FC<BattleHighlightProps & { currentFrame?: number }> = ({
  matchId,
  format = 'HORIZONTAL',
  durationInSeconds = 15,
  fps = 30,
  currentFrame = 0,
  winner,
  opponent,
  timelineEvents = [],
  winnerProgressions = [],
}) => {
  const isVertical = format === 'VERTICAL';
  const width = isVertical ? 1080 : 1920;
  const height = isVertical ? 1920 : 1080;
  const totalFrames = durationInSeconds * fps;

  // Frame progress 0 to 1
  const progress = Math.min(Math.max(currentFrame / totalFrames, 0), 1);
  const currentElapsedMs = progress * durationInSeconds * 1000;

  // Countdown timer: starting from 15.00s down to clutchTimeRemainingMs (e.g. 01.45s)
  const countdownSeconds = Math.max(
    (durationInSeconds * 1000 - currentElapsedMs * 0.9) / 1000,
    winner.clutchTimeRemainingMs / 1000,
  ).toFixed(2);

  // Victory Fanfare banner entrance starts at 75% duration (frame totalFrames * 0.75)
  const fanfareStartFrame = Math.floor(totalFrames * 0.75);
  const fanfareActive = currentFrame >= fanfareStartFrame;
  const fanfareScale = fanfareActive
    ? Math.min(1, (currentFrame - fanfareStartFrame) / 15)
    : 0;
  const fanfareOpacity = fanfareActive
    ? Math.min(1, (currentFrame - fanfareStartFrame) / 10)
    : 0;

  // Code snippets progression based on elapsed time
  const currentWinnerSnippet =
    timelineEvents
      .filter((e) => e.author === 'winner' && e.timestampMs <= currentElapsedMs)
      .slice(-1)[0]?.codeSnippet || winner.finalCode.slice(0, Math.floor(progress * winner.finalCode.length));

  const currentOpponentSnippet =
    timelineEvents
      .filter((e) => e.author === 'opponent' && e.timestampMs <= currentElapsedMs)
      .slice(-1)[0]?.codeSnippet || opponent.finalCode.slice(0, Math.floor(progress * 0.8 * opponent.finalCode.length));

  // Test passed count animation
  const currentTestProgression =
    winnerProgressions
      .filter((p) => p.timestampMs <= currentElapsedMs)
      .slice(-1)[0] || { passedTests: Math.floor(progress * winner.testsPassed), totalTests: winner.totalTests };

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#0a0d14',
        color: '#f8fafc',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        padding: isVertical ? '32px 24px' : '40px',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Neon Grid / Glow */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, rgba(14,165,233,0.08) 50%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Header & Clutch Timer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid rgba(255,255,255,0.1)',
          paddingBottom: '20px',
          marginBottom: '24px',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              padding: '6px 14px',
              backgroundColor: '#ef4444',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: isVertical ? '18px' : '20px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)',
            }}
          >
            CLUTCH REEL
          </div>
          <span style={{ fontSize: isVertical ? '20px' : '24px', fontWeight: 700, color: '#e2e8f0' }}>
            CodePulse Esports Arena
          </span>
        </div>

        {/* Dynamic Countdown Timer */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Match Countdown
          </div>
          <div
            style={{
              fontSize: isVertical ? '36px' : '44px',
              fontWeight: 900,
              color: parseFloat(countdownSeconds) <= 3.0 ? '#ef4444' : '#f59e0b',
              textShadow: '0 0 12px rgba(245, 158, 11, 0.5)',
            }}
          >
            00:{countdownSeconds.padStart(5, '0')}
          </div>
        </div>
      </div>

      {/* Main Content Area: Side-by-Side or Stacked Editors */}
      <div
        style={{
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          gap: '24px',
          flex: 1,
          zIndex: 10,
        }}
      >
        {/* Winner (Challenger) Pane */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#111827',
            borderRadius: '16px',
            border: '2px solid #10b981',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(16, 185, 129, 0.25)',
          }}
        >
          {/* Player Header */}
          <div
            style={{
              backgroundColor: '#1f2937',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #374151',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '20px',
                  color: '#042f2e',
                }}
              >
                {winner.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '18px', color: '#10b981' }}>
                  {winner.username} (WINNER)
                </div>
                <div style={{ fontSize: '13px', color: '#9ca3af' }}>Rating: {winner.rating} MMR</div>
              </div>
            </div>

            {/* Test progress badge */}
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                padding: '6px 14px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '14px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              Tests: {currentTestProgression.passedTests}/{currentTestProgression.totalTests}
            </div>
          </div>

          {/* Code Window */}
          <pre
            style={{
              margin: 0,
              padding: '20px',
              flex: 1,
              backgroundColor: '#0d1117',
              color: '#58a6ff',
              fontSize: isVertical ? '14px' : '16px',
              lineHeight: '1.6',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            <code>
              {currentWinnerSnippet}
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '18px',
                  backgroundColor: '#10b981',
                  marginLeft: '4px',
                  verticalAlign: 'middle',
                  animation: 'blink 1s infinite',
                }}
              />
            </code>
          </pre>
        </div>

        {/* Opponent Pane */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#111827',
            borderRadius: '16px',
            border: '1px solid #374151',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            opacity: 0.85,
          }}
        >
          {/* Player Header */}
          <div
            style={{
              backgroundColor: '#1f2937',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #374151',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '20px',
                  color: '#f3f4f6',
                }}
              >
                {opponent.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '18px', color: '#e5e7eb' }}>
                  {opponent.username}
                </div>
                <div style={{ fontSize: '13px', color: '#9ca3af' }}>Rating: {opponent.rating} MMR</div>
              </div>
            </div>

            {/* Test progress badge */}
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                padding: '6px 14px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '14px',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              Tests: {opponent.testsPassed}/{opponent.totalTests}
            </div>
          </div>

          {/* Code Window */}
          <pre
            style={{
              margin: 0,
              padding: '20px',
              flex: 1,
              backgroundColor: '#0d1117',
              color: '#d1d5db',
              fontSize: isVertical ? '14px' : '16px',
              lineHeight: '1.6',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            <code>{currentOpponentSnippet}</code>
          </pre>
        </div>
      </div>

      {/* Victory Fanfare Splash / Banner Graphic Overlay */}
      {fanfareActive && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${fanfareScale})`,
            opacity: fanfareOpacity,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '4px solid #10b981',
            borderRadius: '24px',
            padding: isVertical ? '32px 24px' : '48px 64px',
            textAlign: 'center',
            boxShadow: '0 0 60px rgba(16, 185, 129, 0.7)',
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: isVertical ? '44px' : '64px', fontWeight: 900, color: '#f59e0b' }}>
            🏆 CLUTCH VICTORY! 🏆
          </div>
          <div style={{ fontSize: isVertical ? '24px' : '32px', fontWeight: 800, marginTop: '12px', color: '#10b981' }}>
            {winner.username} wins with {(winner.clutchTimeRemainingMs / 1000).toFixed(2)}s left!
          </div>
          <div style={{ fontSize: '18px', color: '#cbd5e1', marginTop: '16px' }}>
            All {winner.totalTests}/{winner.totalTests} test suites passed! +32 MMR
          </div>
          <div
            style={{
              marginTop: '24px',
              padding: '10px 24px',
              backgroundColor: '#10b981',
              color: '#022c22',
              borderRadius: '999px',
              fontWeight: 800,
              fontSize: '18px',
              display: 'inline-block',
            }}
          >
            codepulse.io/battles/{matchId}
          </div>
        </div>
      )}
    </div>
  );
};
