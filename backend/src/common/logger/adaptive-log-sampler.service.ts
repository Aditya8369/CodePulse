import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { LogRateControllerService } from './log-rate-controller.service';

export interface LogPayload {
  level: 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  statusCode?: number;
  stack?: string;
  context?: string;
  timestamp?: Date;
}

export interface SamplingDecision {
  allow: boolean;
  isFirstOccurrence: boolean;
  signature: string;
  suppressedCountSoFar: number;
  summaryMessage?: string;
}

interface SignatureTracker {
  signature: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  totalOccurrences: number;
  suppressedCount: number;
  lastSampledIndex: number;
}

@Injectable()
export class AdaptiveLogSamplerService {
  private readonly logger = new Logger(AdaptiveLogSamplerService.name);
  private readonly signatureMap = new Map<string, SignatureTracker>();

  constructor(private readonly rateController: LogRateControllerService) {}

  /**
   * Generates a deterministic hash from the error stack or message,
   * normalizing dynamic parameters (timestamps, IDs, file line numbers).
   */
  public computeSignature(payload: LogPayload): string {
    const base = payload.stack || payload.message;
    // Normalize UUIDs, hex tokens, and line/col numbers
    const normalized = base
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
      .replace(/0x[0-9a-f]+/gi, '<HEX>')
      .replace(/:\d+:\d+/g, ':<LINE>:<COL>')
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/g, '<TIMESTAMP>');

    return crypto.createHash('sha256').update(`${payload.level}:${payload.statusCode || ''}:${normalized}`).digest('hex').substring(0, 16);
  }

  /**
   * Evaluates an incoming log entry:
   * 1. First occurrence of any signature is ALWAYS allowed.
   * 2. Subsequent occurrences are sampled dynamically based on incident rate suppression tier.
   * 3. Periodic summary logs are injected with total suppressed count.
   */
  public evaluate(payload: LogPayload): SamplingDecision {
    const signature = this.computeSignature(payload);
    const now = new Date();
    const rateEval = this.rateController.evaluateRate(now.getTime());

    let tracker = this.signatureMap.get(signature);
    if (!tracker) {
      // First occurrence of new unique error signature: ALWAYS ALLOW
      tracker = {
        signature,
        firstSeenAt: now,
        lastSeenAt: now,
        totalOccurrences: 1,
        suppressedCount: 0,
        lastSampledIndex: 1,
      };
      this.signatureMap.set(signature, tracker);

      return {
        allow: true,
        isFirstOccurrence: true,
        signature,
        suppressedCountSoFar: 0,
      };
    }

    tracker.totalOccurrences++;
    tracker.lastSeenAt = now;

    // In normal operation, allow logs
    if (rateEval.tier === 'NORMAL') {
      return {
        allow: true,
        isFirstOccurrence: false,
        signature,
        suppressedCountSoFar: tracker.suppressedCount,
      };
    }

    // Under ELEVATED or SURGE_SUPPRESSION: calculate sample interval
    // samplingRatio 0.10 => sample 1 out of 10
    const sampleInterval = Math.max(2, Math.round(1 / rateEval.samplingRatio));
    const shouldSample = tracker.totalOccurrences % sampleInterval === 0;

    if (shouldSample) {
      const suppressedSinceLast = tracker.totalOccurrences - tracker.lastSampledIndex - 1;
      tracker.lastSampledIndex = tracker.totalOccurrences;

      return {
        allow: true,
        isFirstOccurrence: false,
        signature,
        suppressedCountSoFar: tracker.suppressedCount,
        summaryMessage: suppressedSinceLast > 0
          ? `[SUPPRESSION SUMMARY] Suppressed ${suppressedSinceLast} duplicate log entries matching signature ${signature} during incident volume surge.`
          : undefined,
      };
    } else {
      tracker.suppressedCount++;
      this.rateController.recordSuppression(1);
      return {
        allow: false,
        isFirstOccurrence: false,
        signature,
        suppressedCountSoFar: tracker.suppressedCount,
      };
    }
  }

  public getSignatureStats(): SignatureTracker[] {
    return Array.from(this.signatureMap.values());
  }
}
