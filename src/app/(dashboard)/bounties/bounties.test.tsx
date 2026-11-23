import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import BountiesPage from './page';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('BountiesPage & BountyEscrowDrawer', () => {
  it('renders bounties page with initial bounties and escrow hashes', () => {
    render(<BountiesPage />);

    expect(screen.getByTestId('bounties-page-container')).toBeInTheDocument();
    expect(screen.getByText('Open Source Issue Bounties')).toBeInTheDocument();
    expect(screen.getByTestId('bounty-card-bty_1')).toBeInTheDocument();
    expect(screen.getByText('+350 XP Bounty')).toBeInTheDocument();
  });

  it('filters bounties by search query', () => {
    render(<BountiesPage />);

    const searchInput = screen.getByTestId('bounties-search-input');
    fireEvent.change(searchInput, { target: { value: 'Rust' } });

    expect(screen.getByText('Implement zero-copy JSON parser for battle webhooks')).toBeInTheDocument();
    expect(screen.queryByText('Refactor chart components with virtualized canvas rendering')).not.toBeInTheDocument();
  });

  it('opens pledge escrow drawer when clicking + Place Bounty button', () => {
    render(<BountiesPage />);

    const placeBtn = screen.getByTestId('open-place-bounty-btn');
    fireEvent.click(placeBtn);

    expect(screen.getByTestId('bounty-escrow-drawer')).toBeInTheDocument();
    expect(screen.getByText('Lock Bounty Escrow Pledge')).toBeInTheDocument();
    expect(screen.getByTestId('escrow-tx-hash-display')).toBeInTheDocument();
  });

  it('opens claim review drawer when clicking Claim Bounty on an open card', () => {
    render(<BountiesPage />);

    const claimBtn = screen.getByTestId('claim-bounty-btn-bty_1');
    fireEvent.click(claimBtn);

    expect(screen.getByTestId('bounty-escrow-drawer')).toBeInTheDocument();
    expect(screen.getByText('Claim & Review Escrow Bounty')).toBeInTheDocument();
    expect(screen.getByTestId('claim-pr-url-input')).toBeInTheDocument();
  });
});
