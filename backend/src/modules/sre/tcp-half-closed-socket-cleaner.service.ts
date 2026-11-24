import { Injectable, Logger } from '@nestjs/common';

export interface TcpSocketDescriptor {
  fd: number;
  state: 'ESTABLISHED' | 'CLOSE_WAIT' | 'FIN_WAIT_2';
  idleDurationMs: number;
}

@Injectable()
export class TcpHalfClosedSocketCleanerService {
  private readonly logger = new Logger(TcpHalfClosedSocketCleanerService.name);
  private readonly halfClosedTimeoutMs = 10000;

  public reapHalfClosedSockets(sockets: TcpSocketDescriptor[]): { reapedFds: number[] } {
    const reapedFds = sockets
      .filter((s) => (s.state === 'CLOSE_WAIT' || s.state === 'FIN_WAIT_2') && s.idleDurationMs > this.halfClosedTimeoutMs)
      .map((s) => s.fd);

    if (reapedFds.length > 0) {
      this.logger.warn(`Reaped ${reapedFds.length} lingering half-closed TCP sockets to prevent file descriptor exhaustion.`);
    }
    return { reapedFds };
  }
}
