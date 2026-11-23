import { Socket } from 'socket.io';
import { MetricsService } from '../metrics/metrics.service';
import { BattlesGateway } from './battles.gateway';

describe('BattlesGateway Zero-Downtime Socket Rebalancing & Drainage (#1053)', () => {
  let gateway: BattlesGateway;
  let mockMetrics: MetricsService;
  let mockServer: any;

  beforeEach(() => {
    mockMetrics = {
      socketConnected: jest.fn(),
      socketDisconnected: jest.fn(),
    } as unknown as MetricsService;

    gateway = new BattlesGateway(mockMetrics);
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      disconnectSockets: jest.fn(),
    };
    gateway.server = mockServer;
  });

  afterEach(() => {
    gateway.cancelDrainage();
    gateway.onModuleDestroy();
  });

  it('starts in healthy, non-draining state', () => {
    expect(gateway.isDraining()).toBe(false);
    expect(gateway.getActiveMatchCount()).toBe(0);
    expect(gateway.getDrainStatus().isDraining).toBe(false);
  });

  it('initiates drainage, alerts active battles, and resolves when no matches are active', async () => {
    const drainPromise = gateway.startDrainage(1000);
    expect(gateway.isDraining()).toBe(true);

    await drainPromise;
    expect(mockServer.disconnectSockets).toHaveBeenCalledWith(true);
  });

  it('rejects new connections when pod is draining', () => {
    void gateway.startDrainage(5000);
    expect(gateway.isDraining()).toBe(true);

    const client = {
      id: 'incoming-client-1',
      emit: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as Socket;

    gateway.handleConnection(client);

    expect(client.emit).toHaveBeenCalledWith('socket:rebalance', {
      reason: 'pod_draining',
      message: 'Pod is undergoing rolling deployment; please connect to an active pod.',
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(mockMetrics.socketConnected).not.toHaveBeenCalled();
  });

  it('allows cancellation of drainage if deployment is aborted', () => {
    void gateway.startDrainage(5000);
    expect(gateway.isDraining()).toBe(true);

    gateway.cancelDrainage();
    expect(gateway.isDraining()).toBe(false);
  });
});
