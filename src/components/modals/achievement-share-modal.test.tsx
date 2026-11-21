import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AchievementShareModal } from './achievement-share-modal';

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

  it('renders achievement details accurately', () => {
    render(
      <AchievementShareModal
        isOpen={true}
        onClose={vi.fn()}
        achievement={mockAchievement}
      />
    );

    expect(screen.getByText(/CodePulse Champion/i)).toBeInTheDocument();
    expect(screen.getByText('Ranked in the top 1% global leaderboards')).toBeInTheDocument();
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

    const copyBtn = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
