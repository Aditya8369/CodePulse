import { TimeseriesIngestionService } from './timeseries-ingestion.service';

describe('TimeseriesIngestionService', () => {
  let service: TimeseriesIngestionService;

  beforeEach(() => {
    service = new TimeseriesIngestionService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should ingest high-frequency keystroke points into columnar chunks', () => {
    const points = [
      { time: Date.now() * 1000, matchId: 'm-1', playerId: 'p-1', keyChar: 'c', flightTimeMs: 12, holdTimeMs: 45, pressureLevel: 0.8 },
      { time: (Date.now() + 10) * 1000, matchId: 'm-1', playerId: 'p-1', keyChar: 'p', flightTimeMs: 15, holdTimeMs: 50, pressureLevel: 0.9 },
    ];

    const count = service.ingestPoints(points);
    expect(count).toBe(2);
    expect(service.getMetrics().totalPointsIngested).toBe(2);
  });
});
