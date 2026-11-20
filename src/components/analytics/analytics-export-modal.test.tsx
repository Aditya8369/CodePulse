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
        metrics={mockMetrics}
      />
    );

    expect(screen.getByText(/Export Analytics Report/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AnalyticsExportModal
        isOpen={false}
        onClose={vi.fn()}
        metrics={mockMetrics}
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
        metrics={mockMetrics}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /close|cancel/i }) || screen.getAllByRole('button')[0];
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
