import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import MentorshipPage from './page';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MentorshipPage & MentorPairingCard', () => {
  it('renders mentorship page with mentor profiles and cosine similarity badges', () => {
    render(<MentorshipPage />);

    expect(screen.getByTestId('mentorship-page-container')).toBeInTheDocument();
    expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
    expect(screen.getByTestId('match-badge-elena_rust')).toHaveTextContent('96% Match');
    expect(screen.getByTestId('shadow-code-btn-elena_rust')).toBeInTheDocument();
  });

  it('filters mentors by search input', () => {
    render(<MentorshipPage />);

    const searchInput = screen.getByTestId('mentorship-search-input');
    fireEvent.change(searchInput, { target: { value: 'Marcus' } });

    expect(screen.getByText('Marcus Vance')).toBeInTheDocument();
    expect(screen.queryByText('Elena Rostova')).not.toBeInTheDocument();
  });

  it('filters mentors by tech stack filter button', () => {
    render(<MentorshipPage />);

    const goFilterBtn = screen.getByTestId('tech-filter-Go');
    fireEvent.click(goFilterBtn);

    expect(screen.getByText('Aisha Patel')).toBeInTheDocument();
    expect(screen.queryByText('Marcus Vance')).not.toBeInTheDocument();
  });

  it('opens shadow coding launcher modal when clicking Shadow Code button', () => {
    render(<MentorshipPage />);

    const shadowBtn = screen.getByTestId('shadow-code-btn-elena_rust');
    fireEvent.click(shadowBtn);

    expect(screen.getByTestId('shadow-coding-launch-modal')).toBeInTheDocument();
    expect(screen.getByText(/Shadow Session with Elena Rostova/i)).toBeInTheDocument();
    expect(screen.getByTestId('confirm-shadow-launch-btn')).toBeInTheDocument();

    // Confirm launch
    fireEvent.click(screen.getByTestId('confirm-shadow-launch-btn'));
    expect(screen.queryByTestId('shadow-coding-launch-modal')).not.toBeInTheDocument();
  });
});
