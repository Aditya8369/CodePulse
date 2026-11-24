import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AutocompleteBloomCacheService {
  private readonly logger = new Logger(AutocompleteBloomCacheService.name);
  private filter = new Set<string>();

  public addPrefix(prefix: string): void {
    this.filter.add(prefix.toLowerCase());
  }

  public mightContain(prefix: string): boolean {
    return this.filter.has(prefix.toLowerCase());
  }
}
