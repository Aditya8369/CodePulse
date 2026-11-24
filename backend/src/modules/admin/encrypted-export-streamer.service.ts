import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptedExportStreamerService {
  private readonly logger = new Logger(EncryptedExportStreamerService.name);

  public encryptChunk(dataChunk: string, keyHex: string): { ivHex: string; encryptedHex: string; authTagHex: string } {
    const iv = crypto.randomBytes(12);
    const key = Buffer.from(keyHex, 'hex');
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(dataChunk, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      ivHex: iv.toString('hex'),
      encryptedHex: encrypted,
      authTagHex: authTag.toString('hex')
    };
  }
}
