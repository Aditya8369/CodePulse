import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RoaringBitmapsIndexingService {
  private readonly logger = new Logger(RoaringBitmapsIndexingService.name);
  private readonly bitmapStore = new Map<string, Set<number>>();

  public indexAttribute(attributeKey: string, entityId: number): void {
    if (!this.bitmapStore.has(attributeKey)) {
      this.bitmapStore.set(attributeKey, new Set());
    }
    this.bitmapStore.get(attributeKey)!.add(entityId);
  }

  public queryIntersection(attrA: string, attrB: string): number[] {
    const setA = this.bitmapStore.get(attrA) || new Set();
    const setB = this.bitmapStore.get(attrB) || new Set();
    const result: number[] = [];
    for (const id of setA) {
      if (setB.has(id)) result.push(id);
    }
    return result;
  }
}
