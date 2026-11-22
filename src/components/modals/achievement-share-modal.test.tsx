import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AchievementShareModal, BattleVictoryShareData } from './achievement-share-modal';

describe('AchievementShareModal Component', () => {
  const mockAchievement: any = {
    id: 'ach_1',
    title: 'CodePulse Champion',
    description: 'Ranked in the top 1% global leaderboards',
    xpReward: 500,
    icon: '🏆',
    category: 'battles',
    rarity: 'legendary',
    isUnlocked: true,
    progress: 100,
    maxProgress: 100,
    unlockedAt: new Date(),
  };

  it('renders achievement details and opengraph preview', () => {
    render(
      <AchievementShareModal
        isOpen={true}
        onClose={vi.fn()}
        achievement={mockAchievement}
      />
    );

    expect(screen.getByText(/CodePulse Champion/i)).toBeInTheDocument();
    expect(screen.getByText('Ranked in the top 1% global leaderboards')).toBeInTheDocument();
    expect(screen.getByTestId('opengraph-preview-card')).toBeInTheDocument();
    expect(screen.getByText('codepulse.dev')).toBeInTheDocument();
  });

  it('renders battle victory details when victory prop is provided', () => {
    const mockVictory: BattleVictoryShareData = {
      battleId: 'battle_999',
      opponentName: 'CodeNinja42',
      challengeTitle: 'Dynamic Graph Shortest Path',
      xpEarned: 250,
      eloChange: 35,
    };

    render(
      <AchievementShareModal
        isOpen={true}
        onClose={vi.fn()}
        victory={mockVictory}
      />
    );

    expect(screen.getByText(/Victory Over CodeNinja42/i)).toBeInTheDocument();
    expect(screen.getByText(/\+35 ELO/i)).toBeInTheDocument();
    expect(screen.getByText(/\+250 XP Reward/i)).toBeInTheDocument();
    expect(screen.getByTestId('opengraph-preview-card')).toBeInTheDocument();
  });

  it('triggers clipboard copy when copy button is pressed', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });

    render(
      <AchievementShareModal
        isOpen={true}
        onClose={vi.fn()}
        achievement={mockAchievement}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /copy link/i });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
