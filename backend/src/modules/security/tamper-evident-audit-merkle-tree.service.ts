import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class TamperEvidentAuditMerkleTreeService {
  public computeMerkleRoot(leaves: string[]): string {
    if (leaves.length === 0) return '';
    let current = leaves.map(l => crypto.createHash('sha256').update(l).digest('hex'));

    while (current.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i];
        const right = i + 1 < current.length ? current[i + 1] : left;
        const combined = crypto.createHash('sha256').update(left + right).digest('hex');
        nextLevel.push(combined);
      }
      current = nextLevel;
    }

    return current[0];
  }
}
