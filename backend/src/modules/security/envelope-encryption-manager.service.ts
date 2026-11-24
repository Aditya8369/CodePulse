import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

export interface EnvelopePayload {
  encryptedData: string;
  encryptedDek: string;
  iv: string;
}

@Injectable()
export class EnvelopeEncryptionManagerService {
  private readonly masterKey = crypto.randomBytes(32);

  public encryptTenantData(plaintext: string): EnvelopePayload {
    // Generate ephemeral Data Encryption Key (DEK)
    const dek = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    // Encrypt data with DEK
    const cipher = crypto.createCipheriv('aes-256-cbc', dek, iv);
    let encryptedData = cipher.update(plaintext, 'utf8', 'hex');
    encryptedData += cipher.final('hex');

    // Encrypt DEK with Master Key (KEK)
    const kekCipher = crypto.createCipheriv('aes-256-cbc', this.masterKey, iv);
    let encryptedDek = kekCipher.update(dek.toString('hex'), 'utf8', 'hex');
    encryptedDek += kekCipher.final('hex');

    return { encryptedData, encryptedDek, iv: iv.toString('hex') };
  }
}
