import { Injectable, Logger } from '@nestjs/common';

export interface MigrationResolution {
  strategy: 'EXEC_ASKING' | 'REFRESH_TOPOLOGY' | 'STANDARD';
  targetNode?: string;
  slot?: number;
}

@Injectable()
export class RedisSlotMigrationRaceResolverService {
  private readonly logger = new Logger(RedisSlotMigrationRaceResolverService.name);

  public handleClusterError(errorMessage: string): MigrationResolution {
    if (errorMessage.startsWith('ASK')) {
      const parts = errorMessage.split(' ');
      const slot = parseInt(parts[1], 10);
      const targetNode = parts[2];
      this.logger.warn(`Redis ASK redirect received for slot ${slot} -> ${targetNode}`);
      return { strategy: 'EXEC_ASKING', targetNode, slot };
    }

    if (errorMessage.startsWith('MOVED')) {
      const parts = errorMessage.split(' ');
      const slot = parseInt(parts[1], 10);
      const targetNode = parts[2];
      this.logger.warn(`Redis MOVED redirect received for slot ${slot} -> ${targetNode}`);
      return { strategy: 'REFRESH_TOPOLOGY', targetNode, slot };
    }

    return { strategy: 'STANDARD' };
  }
}
