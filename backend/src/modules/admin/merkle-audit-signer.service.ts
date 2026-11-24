import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class MerkleAuditSignerService {
  private readonly logger = new Logger(MerkleAuditSignerService.name);

  public computeMerkleRoot(logEntries: string[]): string {
    if (!logEntries || logEntries.length === 0) return '';

    let hashes = logEntries.map(e => crypto.createHash('sha256').update(e).digest('hex'));

    while (hashes.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < hashes.length; i += 2) {
        if (i + 1 < hashes.length) {
          const combined = hashes[i] + hashes[i + 1];
          nextLevel.push(crypto.createHash('sha256').update(combined).digest('hex'));
        } else {
          nextLevel.push(hashes[i]); // Odd element carry-over
        }
      }
      hashes = nextLevel;
    }

    return hashes[0];
  }
}
