import { GracefulShutdownCoordinatorService, WebSocketSessionStub } from './graceful-shutdown-coordinator.service';

describe('GracefulShutdownCoordinatorService', () => {
  let coordinator: GracefulShutdownCoordinatorService;

  beforeEach(() => {
    coordinator = new GracefulShutdownCoordinatorService(1000); // 1s timeout for testing
  });

  it('should accept requests when healthy', () => {
    expect(coordinator.isHealthy()).toBe(true);
    const accepted = coordinator.registerRequest('req-1', '/api/challenges');
    expect(accepted).toBe(true);
    expect(coordinator.getInFlightCount()).toBe(1);

    coordinator.completeRequest('req-1');
    expect(coordinator.getInFlightCount()).toBe(0);
  });

  it('should reject new requests once shutdown sequence initiates', async () => {
    const shutdownPromise = coordinator.initiateShutdown();

    expect(coordinator.isHealthy()).toBe(false);
    expect(coordinator.registerRequest('req-2', '/api/battles')).toBe(false);

    await shutdownPromise;
    expect(coordinator.getPhase()).toBe('TERMINATED');
  });

  it('should broadcast DISCONNECT_IMMINENT to active WebSockets upon shutdown', async () => {
    const sentMessages: string[] = [];
    let closed = false;

    const mockWs: WebSocketSessionStub = {
      id: 'ws-user-99',
      send: (msg) => sentMessages.push(msg),
      close: () => { closed = true; },
    };

    coordinator.registerWebSocket(mockWs);
    await coordinator.initiateShutdown();

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0]).toContain('DISCONNECT_IMMINENT');
    expect(sentMessages[0]).toContain('reconnectToken');
    expect(closed).toBe(true);
  });

  it('should wait for in-flight requests to complete before terminating', async () => {
    coordinator.registerRequest('req-async', '/api/heavy-calc');

    let completed = false;
    const shutdownPromise = coordinator.initiateShutdown().then(() => {
      completed = true;
    });

    expect(completed).toBe(false);

    // Complete the request after 100ms
    setTimeout(() => {
      coordinator.completeRequest('req-async');
    }, 100);

    await shutdownPromise;
    expect(completed).toBe(true);
    expect(coordinator.getInFlightCount()).toBe(0);
  });
});
