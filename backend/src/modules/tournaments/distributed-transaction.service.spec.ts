import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DistributedTransactionCoordinator,
  TwoPhaseParticipant,
} from './distributed-transaction.service';

describe('DistributedTransactionCoordinator (2PC Distributed Payouts)', () => {
  let coordinator: DistributedTransactionCoordinator;

  beforeEach(() => {
    coordinator = new DistributedTransactionCoordinator();
  });

  it('successfully commits transaction when all participants prepare', async () => {
    const escrowParticipant: TwoPhaseParticipant = {
      name: 'EscrowVault',
      prepare: vi.fn().mockResolvedValue(true),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    const userBalanceParticipant: TwoPhaseParticipant = {
      name: 'UserBalanceService',
      prepare: vi.fn().mockResolvedValue(true),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    const xpLedgerParticipant: TwoPhaseParticipant = {
      name: 'XpLedgerService',
      prepare: vi.fn().mockResolvedValue(true),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    const result = await coordinator.executeTransaction({
      tournamentId: 'tourney-100',
      context: { payoutAmount: 500, winnerId: 'user-777' },
      participants: [escrowParticipant, userBalanceParticipant, xpLedgerParticipant],
    });

    expect(result.success).toBe(true);
    expect(result.phase).toBe('COMMITTED');

    expect(escrowParticipant.prepare).toHaveBeenCalledOnce();
    expect(userBalanceParticipant.prepare).toHaveBeenCalledOnce();
    expect(xpLedgerParticipant.prepare).toHaveBeenCalledOnce();

    expect(escrowParticipant.commit).toHaveBeenCalledOnce();
    expect(userBalanceParticipant.commit).toHaveBeenCalledOnce();
    expect(xpLedgerParticipant.commit).toHaveBeenCalledOnce();

    expect(escrowParticipant.rollback).not.toHaveBeenCalled();

    const record = coordinator.getTransaction(result.txId);
    expect(record).toBeDefined();
    expect(record?.phase).toBe('COMMITTED');
    expect(record?.journal.some((j) => j.phase === 'COMMITTED')).toBe(true);
  });

  it('aborts and rolls back prepared participants if one participant declines prepare', async () => {
    const escrowParticipant: TwoPhaseParticipant = {
      name: 'EscrowVault',
      prepare: vi.fn().mockResolvedValue(true),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    const insufficientFundsParticipant: TwoPhaseParticipant = {
      name: 'UserBalanceService',
      prepare: vi.fn().mockResolvedValue(false), // Declines!
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    const result = await coordinator.executeTransaction({
      tournamentId: 'tourney-101',
      context: { payoutAmount: 10000, winnerId: 'user-888' },
      participants: [escrowParticipant, insufficientFundsParticipant],
    });

    expect(result.success).toBe(false);
    expect(result.phase).toBe('ABORTED');
    expect(result.error).toContain('declined prepare phase');

    // Escrow prepared, so it must be rolled back to prevent orphaned funds
    expect(escrowParticipant.commit).not.toHaveBeenCalled();
    expect(escrowParticipant.rollback).toHaveBeenCalledOnce();
  });

  it('aborts transaction if prepare times out', async () => {
    const slowParticipant: TwoPhaseParticipant = {
      name: 'SlowExternalBank',
      prepare: vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 200))
      ),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    const result = await coordinator.executeTransaction({
      context: { amount: 50 },
      participants: [slowParticipant],
      timeoutMs: 50, // times out before 200ms
    });

    expect(result.success).toBe(false);
    expect(result.phase).toBe('ABORTED');
    expect(result.error).toContain('timed out');
  });
});
