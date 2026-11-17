import { Socket } from 'socket.io';
import { MetricsService } from '../metrics/metrics.service';
import { BattlesGateway } from './battles.gateway';

describe('BattlesGateway metrics', () => {
  it('tracks connection and disconnection lifecycle events', () => {
    const metrics = {
      socketConnected: jest.fn(),
      socketDisconnected: jest.fn(),
    };
    const gateway = new BattlesGateway(metrics as unknown as MetricsService);
    const client = { id: 'socket-1' } as Socket;
    gateway.handleConnection(client);
    gateway.handleDisconnect(client);
    expect(metrics.socketConnected).toHaveBeenCalledWith('socket-1');
    expect(metrics.socketDisconnected).toHaveBeenCalledWith('socket-1');
  });
});
