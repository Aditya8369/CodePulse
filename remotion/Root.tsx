import React from 'react';
import { Composition } from 'remotion';
import {
  BattleHighlightComposition,
  BattleHighlightProps,
} from './BattleHighlightComposition';

const defaultMockProps: BattleHighlightProps = {
  matchId: 'battle-sample-101',
  format: 'HORIZONTAL',
  durationInSeconds: 30,
  winner: {
    username: 'CodeChampion',
    rating: 2150,
    finalCode: 'function solve(nums) {\n  return nums.reduce((a, b) => a + b, 0);\n}',
    testsPassed: 10,
    totalTests: 10,
    clutchTimeRemainingMs: 2400,
  },
  opponent: {
    username: 'RivalCoder',
    rating: 2080,
    finalCode: 'function solve(nums) {\n  let sum = 0;\n  for(let x of nums) sum += x;\n}',
    testsPassed: 8,
    totalTests: 10,
  },
  timelineEvents: [],
  winnerProgressions: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 1080p Landscape (1920x1080) for YouTube / Twitter / LinkedIn */}
      <Composition
        id="BattleHighlightHorizontal"
        component={BattleHighlightComposition}
        durationInFrames={30 * 30} // 30 seconds at 30 fps = 900 frames
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultMockProps}
      />

      {/* 1080p Portrait (1080x1920) for TikTok / Instagram Reels / YouTube Shorts */}
      <Composition
        id="BattleHighlightVertical"
        component={BattleHighlightComposition}
        durationInFrames={30 * 30} // 30 seconds at 30 fps = 900 frames
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ...defaultMockProps, format: 'VERTICAL' }}
      />
    </>
  );
};
