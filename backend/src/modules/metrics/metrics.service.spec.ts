import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  function createService() {
    const countMock = jest.fn().mockResolvedValue(2);
    const prisma = {
      battle: { count: countMock },
    } as unknown as PrismaService;
    const waitingCounts = [0, 1, 2, 3].map((count) =>
      jest.fn().mockResolvedValue(count),
    );
    const queues = waitingCounts.map((getWaitingCount) => ({
      getWaitingCount,
    })) as unknown as Queue[];
    const service = new MetricsService(
      prisma,
      queues[0],
      queues[1],
      queues[2],
      queues[3],
    );
    return { service, countMock, waitingCounts };
  }

  it('exposes OpenMetrics with bounded HTTP labels and live battle/queue gauges', async () => {
    const { service, countMock, waitingCounts } = createService();
    service.recordHttp('GET', '/api/v1/users/:id', 200, 0.08);
    service.socketConnected('client-a');
    service.socketConnected('client-a');
    service.socketConnected('client-b');
    service.socketDisconnected('client-a');

    const output = await service.metrics();
    expect(service.contentType).toContain('application/openmetrics-text');
    expect(output).toContain('# EOF');
    expect(output).toContain('http_request_duration_seconds_bucket{');
    expect(output).toContain('route="/api/v1/users/:id"');
    expect(output).toContain('status_code="200"');
    expect(output).toContain('ws_active_connections_total 1');
    expect(output).toContain('battles_active_total 2');
    expect(output).toContain(
      'bullmq_queue_waiting_jobs{queue="dead-letter"} 3',
    );
    expect(countMock).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
    });
    expect(waitingCounts[0]).toHaveBeenCalledTimes(1);
  });

  it('does not let an unavailable queue prevent other metrics from being scraped', async () => {
    const { service, waitingCounts } = createService();
    waitingCounts[0].mockRejectedValueOnce(new Error('Redis unavailable'));
    const output = await service.metrics();
    expect(output).toContain(
      'bullmq_queue_waiting_jobs{queue="dead-letter"} 3',
    );
  });
});
