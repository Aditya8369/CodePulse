import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BattleReport } from './battle-report';

describe('BattleReport Component Flow', () => {
  const mockPlayer1 = {
    username: 'alexmercer',
    name: 'Alex Mercer',
    avatar: 'https://github.com/alex.png',
    score: 4,
    stats: { totalCommits: 100 },
    topLanguages: ['TypeScript'],
  };
  const mockPlayer2 = {
    username: 'opponent',
    name: 'Opponent Dev',
    avatar: 'https://github.com/opp.png',
    score: 2,
    stats: { totalCommits: 50 },
    topLanguages: ['Python'],
  };
  const onRematchMock = vi.fn();

  it('renders victory screen with player names and scores', () => {
    render(
      <BattleReport
        player1={mockPlayer1}
        player2={mockPlayer2}
        battleType="speed"
        onRematch={onRematchMock}
      />
    );

    expect(screen.getByRole('heading', { name: 'Alex Mercer' })).toBeInTheDocument();
  });

  it('triggers onRematch callback when action button is clicked', () => {
    render(
      <BattleReport
        player1={mockPlayer1}
        player2={mockPlayer2}
        battleType="speed"
        onRematch={onRematchMock}
      />
    );

    const rematchBtn = screen.getByRole('button', { name: /Rematch/i });
    fireEvent.click(rematchBtn);
    expect(onRematchMock).toHaveBeenCalled();
  });

  it('renders expandable code diff accordion and expands on click', () => {
    render(
      <BattleReport
        player1={mockPlayer1}
        player2={mockPlayer2}
        battleType="speed"
        onRematch={onRematchMock}
      />
    );

    const toggleBtn = screen.getByTestId('code-diff-toggle-button');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    // Click to expand accordion
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Post-Mortem Code Diff & Solution Breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('view-mode-side-by-side')).toBeInTheDocument();
  });
});
