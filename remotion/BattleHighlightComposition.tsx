import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

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
  durationInSeconds: number; // 30s
  fps?: number; // default 30
  winner: {
    username: string;
    avatarUrl?: string;
    rating: number;
    finalCode: string;
    testsPassed: number;
    totalTests: number;
    clutchTimeRemainingMs: number;
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

export const BattleHighlightComposition: React.FC<BattleHighlightProps> = ({
  matchId,
  format = 'HORIZONTAL',
  durationInSeconds = 30,
  winner,
  opponent,
  timelineEvents = [],
  winnerProgressions = [],
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const totalFrames = durationInSeconds * fps;

  // Frame progress 0 to 1
  const progress = Math.min(Math.max(frame / totalFrames, 0), 1);
  const currentElapsedMs = progress * durationInSeconds * 1000;

  // Countdown timer
  const countdownSeconds = Math.max(
    (durationInSeconds * 1000 - currentElapsedMs * 0.9) / 1000,
    winner.clutchTimeRemainingMs / 1000,
  ).toFixed(2);

  // Victory fanfare starts at 75% duration
  const fanfareStartFrame = Math.floor(totalFrames * 0.75);
  const fanfareActive = frame >= fanfareStartFrame;
  const fanfareScale = fanfareActive
    ? interpolate(frame, [fanfareStartFrame, fanfareStartFrame + 15], [0, 1], { extrapolateRight: 'clamp' })
    : 0;
  const fanfareOpacity = fanfareActive
    ? interpolate(frame, [fanfareStartFrame, fanfareStartFrame + 10], [0, 1], { extrapolateRight: 'clamp' })
    : 0;

  const currentWinnerCode = winner.finalCode.slice(
    0,
    Math.floor(winner.finalCode.length * Math.min(1, progress * 1.3)),
  );

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#0a0d14',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        padding: '32px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header bar: Match ID & Countdown Timer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #1e293b',
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8' }}>CodePulse</span>
          <span style={{ fontSize: '18px', color: '#94a3b8' }}>Battle #{matchId.slice(-6)}</span>
        </div>
        <div
          style={{
            fontSize: '28px',
            fontWeight: 800,
            fontFamily: 'monospace',
            color: Number(countdownSeconds) < 5 ? '#ef4444' : '#fbbf24',
          }}
        >
          ⏱️ {countdownSeconds}s
        </div>
      </div>

      {/* Main split arena: Winner vs Opponent code editors */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          gap: '24px',
          marginTop: '24px',
          flexDirection: format === 'VERTICAL' ? 'column' : 'row',
        }}
      >
        {/* Winner Code Editor */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#0f172a',
            borderRadius: '12px',
            border: '2px solid #22c55e',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: 700, fontSize: '20px', color: '#4ade80' }}>
              👑 {winner.username} ({winner.rating} ELO)
            </span>
            <span style={{ color: '#22c55e', fontWeight: 700 }}>
              {winner.testsPassed}/{winner.totalTests} Tests Passed
            </span>
          </div>
          <pre
            style={{
              flex: 1,
              margin: 0,
              fontFamily: 'Fira Code, monospace',
              fontSize: '16px',
              lineHeight: 1.5,
              color: '#e2e8f0',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
            }}
          >
            {currentWinnerCode}
            <span style={{ backgroundColor: '#38bdf8', color: 'transparent' }}>_</span>
          </pre>
        </div>

        {/* Opponent Code Editor */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#0f172a',
            borderRadius: '12px',
            border: '2px solid #334155',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            opacity: 0.85,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: 700, fontSize: '20px', color: '#94a3b8' }}>
              ⚔️ {opponent.username} ({opponent.rating} ELO)
            </span>
            <span style={{ color: '#f87171', fontWeight: 700 }}>
              {opponent.testsPassed}/{opponent.totalTests} Tests
            </span>
          </div>
          <pre
            style={{
              flex: 1,
              margin: 0,
              fontFamily: 'Fira Code, monospace',
              fontSize: '16px',
              lineHeight: 1.5,
              color: '#94a3b8',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
            }}
          >
            {opponent.finalCode}
          </pre>
        </div>
      </div>

      {/* Victory Fanfare Banner Overlay */}
      {fanfareActive && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${fanfareScale})`,
            opacity: fanfareOpacity,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '4px solid #22c55e',
            borderRadius: '24px',
            padding: '40px 60px',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(34, 197, 94, 0.5)',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏆 VICTORY! 🏆</div>
          <div style={{ fontSize: '48px', fontWeight: 900, color: '#4ade80' }}>
            {winner.username} WINS!
          </div>
          <div style={{ fontSize: '20px', color: '#94a3b8', marginTop: '12px' }}>
            Clutch submission with {countdownSeconds}s remaining (+24 ELO)
          </div>
        </div>
      )}
    </div>
  );
};
