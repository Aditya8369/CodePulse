import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DistributedConfigHotreloadService {
  private readonly logger = new Logger(DistributedConfigHotreloadService.name);
  private configCache = new Map<string, string>();

  public applyHotreloadUpdate(key: string, newValue: string): { reloaded: boolean; previousValue?: string } {
    const previous = this.configCache.get(key);
    this.configCache.set(key, newValue);
    this.logger.log(`Hot-reloaded configuration key '${key}' without service restart.`);
    return { reloaded: true, previousValue: previous };
  }

  public get(key: string): string | undefined {
    return this.configCache.get(key);
  }
}
