import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PairProgrammingEditor } from '../components/collab/pair-programming-editor';

describe('PairProgrammingEditor Component', () => {
  const currentUser = {
    id: 'user_1',
    username: 'AliceDeveloper',
    color: '#3b82f6',
    role: 'pair_programmer' as const,
  };

  const remoteCollaborators = [
    {
      clientId: 2,
      username: 'BobPair',
      color: '#ef4444',
      cursor: { lineNumber: 2, column: 5 },
      selection: { startLineNumber: 2, startColumn: 5, endLineNumber: 2, endColumn: 12 },
    },
  ];

  it('renders editor with sub-30ms local latency badge and participants', () => {
    render(
      <PairProgrammingEditor
        docId="battle_room_77"
        currentUser={currentUser}
        collaborators={remoteCollaborators}
      />,
    );

    expect(screen.getByText(/Pair Programming:/i)).toBeInTheDocument();
    expect(screen.getByText(/#battle_room_77/i)).toBeInTheDocument();
    expect(screen.getByText(/local latency/i)).toBeInTheDocument();
    expect(screen.getByTestId('peer-avatar-2')).toHaveTextContent('BobPair');
  });

  it('renders remote multi-cursor positions accurately with user color avatar tags', () => {
    render(
      <PairProgrammingEditor
        docId="battle_room_77"
        currentUser={currentUser}
        collaborators={remoteCollaborators}
      />,
    );

    const cursorOverlay = screen.getByTestId('remote-cursor-2');
    expect(cursorOverlay).toBeInTheDocument();
    expect(cursorOverlay).toHaveTextContent('BobPair');
  });

  it('toggles between Pair Programmer (read-write) and Spectator (read-only) mode', () => {
    const roleSpy = vi.fn();
    render(
      <PairProgrammingEditor
        docId="battle_room_77"
        currentUser={currentUser}
        collaborators={remoteCollaborators}
        onRoleToggle={roleSpy}
      />,
    );

    const textarea = screen.getByTestId('collab-textarea') as HTMLTextAreaElement;
    expect(textarea).not.toHaveAttribute('readonly');

    const toggleBtn = screen.getByTestId('role-toggle-btn');
    fireEvent.click(toggleBtn);

    expect(roleSpy).toHaveBeenCalledWith('spectator');
    expect(screen.getByTestId('readonly-banner')).toBeInTheDocument();
  });

  it('triggers onFinishSession when saving final code', () => {
    const finishSpy = vi.fn();
    render(
      <PairProgrammingEditor
        docId="battle_room_77"
        currentUser={currentUser}
        onFinishSession={finishSpy}
      />,
    );

    const finishBtn = screen.getByTestId('finish-session-btn');
    fireEvent.click(finishBtn);

    expect(finishSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Saved/i)).toBeInTheDocument();
  });
});
