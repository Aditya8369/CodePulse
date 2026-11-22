import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LevelProgressionRing } from './level-progression-ring';

describe('LevelProgressionRing Component', () => {
  it('renders level, animated XP counter, and tier accurately', () => {
    render(
      <LevelProgressionRing
        currentLevel={20}
        currentXp={850}
        xpToNextLevel={1000}
        tierName="Gold"
        animate={false}
      />
    );

    expect(screen.getByTestId('animated-level')).toHaveTextContent('20');
    expect(screen.getByTestId('animated-xp-counter')).toHaveTextContent('850 / 1000 XP (85%)');
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('renders elo rating and positive elo change badge', () => {
    render(
      <LevelProgressionRing
        currentLevel={15}
        currentXp={500}
        xpToNextLevel={1000}
        eloRating={1620}
        eloChange={35}
        animate={false}
      />
    );

    expect(screen.getByTestId('animated-elo-counter')).toHaveTextContent('1620');
    expect(screen.getByTestId('elo-change-badge')).toHaveTextContent('+35');
  });

  it('renders negative elo change badge properly', () => {
    render(
      <LevelProgressionRing
        currentLevel={15}
        currentXp={500}
        xpToNextLevel={1000}
        eloRating={1500}
        eloChange={-20}
        animate={false}
      />
    );

    expect(screen.getByTestId('elo-change-badge')).toHaveTextContent('-20');
  });
});
