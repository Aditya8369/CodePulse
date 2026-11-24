import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface TamperProofReceipt {
  entryHash: string;
  previousHash: string;
  timestamp: number;
  chainedDigest: string;
}

@Injectable()
export class NotaryAuditHasherService {
  private readonly logger = new Logger(NotaryAuditHasherService.name);
  private lastDigest = 'GENESIS';

  public createReceipt(logPayload: string, timestamp: number = Date.now()): TamperProofReceipt {
    const entryHash = crypto.createHash('sha256').update(logPayload).digest('hex');
    const combined = `${this.lastDigest}:${entryHash}:${timestamp}`;
    const chainedDigest = crypto.createHash('sha256').update(combined).digest('hex');

    const receipt: TamperProofReceipt = {
      entryHash,
      previousHash: this.lastDigest,
      timestamp,
      chainedDigest
    };

    this.lastDigest = chainedDigest;
    return receipt;
  }
}
