import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CuckooEventDedupFilterService {
  private readonly logger = new Logger(CuckooEventDedupFilterService.name);
  private fingerprints = new Set<string>();

  public insert(eventId: string): boolean {
    if (this.fingerprints.has(eventId)) {
      return false; // Already present
    }
    this.fingerprints.add(eventId);
    return true;
  }

  public contains(eventId: string): boolean {
    return this.fingerprints.has(eventId);
  }

  public delete(eventId: string): boolean {
    return this.fingerprints.delete(eventId);
  }

  public size(): number {
    return this.fingerprints.size;
  }
}
