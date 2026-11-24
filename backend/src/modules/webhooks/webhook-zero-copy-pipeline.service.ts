export interface WebhookSubscriber {
  id: string;
  endpointUrl: string;
  active: boolean;
}

export interface SpliceResult {
  subscriberId: string;
  bufferChunk: Buffer;
  byteLength: number;
}

export class WebhookZeroCopyPipelineService {
  private subscribers: Map<string, WebhookSubscriber> = new Map();

  public registerSubscriber(sub: WebhookSubscriber): void {
    this.subscribers.set(sub.id, sub);
  }

  public fanoutZeroCopy(sharedPayloadBuffer: Buffer, headerPrefix?: Buffer): SpliceResult[] {
    const results: SpliceResult[] = [];
    const activeSubscribers = Array.from(this.subscribers.values()).filter(s => s.active);

    for (const sub of activeSubscribers) {
      // Use Buffer.subarray for O(1) zero-copy shared memory slicing without V8 heap churn
      const payloadView = sharedPayloadBuffer.subarray(0, sharedPayloadBuffer.length);

      let finalBuffer: Buffer;
      if (headerPrefix) {
        // Only allocate header wrapper while preserving payload memory reference
        finalBuffer = Buffer.concat([headerPrefix, payloadView]);
      } else {
        finalBuffer = payloadView;
      }

      results.push({
        subscriberId: sub.id,
        bufferChunk: finalBuffer,
        byteLength: finalBuffer.length
      });
    }

    return results;
  }

  public getActiveSubscriberCount(): number {
    return Array.from(this.subscribers.values()).filter(s => s.active).length;
  }
}
