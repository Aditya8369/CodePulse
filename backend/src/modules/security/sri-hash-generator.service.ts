import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class SriHashGeneratorService {
  public generateSriHash(fileBuffer: Buffer): string {
    const hash = crypto.createHash('sha384').update(fileBuffer).digest('base64');
    return `sha384-${hash}`;
  }
}
