import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import BattlesPage from './page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/api/use-auth', () => ({ useCurrentUser: () => ({ data: null }) }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><BattlesPage /></QueryClientProvider>);
}


describe('Battles Dashboard Page Flow', () => {
  it('renders battle arena header and mode options', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'DevBattle Arena' })).toBeInTheDocument();
  });

  it('renders quick match or bot challenge button', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Quick Matchmaking Queue' })).toBeInTheDocument();
  });
});
