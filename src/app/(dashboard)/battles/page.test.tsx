import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import BattlesPage from './page';

describe('Battles Dashboard Page Flow', () => {
  it('renders battle arena header and mode options', () => {
    render(<BattlesPage />);

    expect(screen.getByText(/DevBattles|Arena|Match/i)).toBeInTheDocument();
  });

  it('renders quick match or bot challenge button', () => {
    render(<BattlesPage />);

    const actionButtons = screen.getAllByRole('button');
    expect(actionButtons.length).toBeGreaterThan(0);
  });
});
