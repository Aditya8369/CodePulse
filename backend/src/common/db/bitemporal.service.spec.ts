import { BiTemporalService } from './bitemporal.service';

describe('BiTemporalService (Time-Travel Rating Audits)', () => {
  let service: BiTemporalService;

  beforeEach(() => {
    service = new BiTemporalService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should support time-travel querying across both valid time and transaction time', () => {
    // Player rating at Day 1
    const day1 = 1700000000000;
    const day2 = 1700086400000;

    service.recordVersion('player-1', { elo: 1200 }, day1, day2);
    service.recordVersion('player-1', { elo: 1350 }, day2, Infinity);

    // Query As Of Day 1
    const pastRating = service.queryAsOf<{ elo: number }>({
      entityId: 'player-1',
      asOfValidTime: day1 + 1000,
    });
    expect(pastRating?.elo).toBe(1200);

    // Query As Of Day 2
    const currentRating = service.queryAsOf<{ elo: number }>({
      entityId: 'player-1',
      asOfValidTime: day2 + 1000,
    });
    expect(currentRating?.elo).toBe(1350);
  });
});
