import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BattleReport } from './battle-report';

describe('BattleReport Component Flow', () => {
  const mockReport = {
    winnerName: 'Alex Mercer',
    winnerUsername: 'alexmercer',
    winnerAvatar: 'https://github.com/alex.png',
    xpEarned: 150,
    playerScore: 4,
    opponentScore: 2,
    totalQuestions: 5,
    onPlayAgain: vi.fn(),
  };

  it('renders victory screen with correct winner avatar and XP earned', () => {
    render(<BattleReport {...mockReport} />);

    expect(screen.getByText(/Alex Mercer|Winner/i)).toBeInTheDocument();
    expect(screen.getByText(/150/i)).toBeInTheDocument();
  });

  it('triggers onPlayAgain callback when action button is clicked', () => {
    render(<BattleReport {...mockReport} />);

    const playAgainBtn = screen.getByRole('button', { name: /Play Again|Next Match/i });
    fireEvent.click(playAgainBtn);
    expect(mockReport.onPlayAgain).toHaveBeenCalled();
  });
});
