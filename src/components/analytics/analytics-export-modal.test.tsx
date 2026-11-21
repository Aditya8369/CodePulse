import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AnalyticsExportModal } from './analytics-export-modal';

describe('AnalyticsExportModal Component', () => {
  const mockMetrics = {
    totalCommits: 450,
    pullRequests: 82,
    codeReviews: 34,
    streakDays: 14,
  };

  it('renders modal when isOpen is true', () => {
    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={vi.fn()}
        stats={mockMetrics}
        currentUser={{ id: 'test-user', username: 'testcoder', name: 'Test Coder' }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Export Developer Analytics' })).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AnalyticsExportModal
        isOpen={false}
        onClose={vi.fn()}
        stats={mockMetrics}
        currentUser={{ id: 'test-user', username: 'testcoder', name: 'Test Coder' }}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <AnalyticsExportModal
        isOpen={true}
        onClose={handleClose}
        stats={mockMetrics}
        currentUser={{ id: 'test-user', username: 'testcoder', name: 'Test Coder' }}
      />
    );

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
