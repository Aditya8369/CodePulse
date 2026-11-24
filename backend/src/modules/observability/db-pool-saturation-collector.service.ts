import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DbPoolSaturationCollectorService {
  private readonly logger = new Logger(DbPoolSaturationCollectorService.name);

  public computeSaturationRatio(activeClients: number, maxClients: number, waitingRequests: number): { saturationRatio: number; poolExhausted: boolean } {
    const saturationRatio = maxClients > 0 ? activeClients / maxClients : 0;
    const poolExhausted = saturationRatio >= 1.0 || waitingRequests > 10;

    if (poolExhausted) {
      this.logger.error(`DATABASE POOL SATURATION: ${activeClients}/${maxClients} in use, ${waitingRequests} queued!`);
    }
    return { saturationRatio, poolExhausted };
  }
}
