/**
 * Architecture Service 77: Envelope Encryption Provider
 * Subsystem: Encryption-At-Rest
 */

import crypto from 'node:crypto';

export interface EncryptedEnvelope {
  encryptedData: string;
  encryptedKey: string;
  iv: string;
}

export class EnvelopeEncryptionProviderService {
  private masterKey: Buffer;

  constructor(masterSecret = 'master-secret-key-32-chars-long!') {
    this.masterKey = crypto.createHash('sha256').update(masterSecret).digest();
  }

  public encrypt(plaintext: string): EncryptedEnvelope {
    const dataKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', dataKey, iv);
    let encryptedData = cipher.update(plaintext, 'utf8', 'hex');
    encryptedData += cipher.final('hex');

    // Encrypt dataKey with masterKey
    const keyCipher = crypto.createCipheriv('aes-256-ecb', this.masterKey, null);
    let encryptedKey = keyCipher.update(dataKey.toString('hex'), 'utf8', 'hex');
    encryptedKey += keyCipher.final('hex');

    return {
      encryptedData,
      encryptedKey,
      iv: iv.toString('hex'),
    };
  }

  public decrypt(envelope: EncryptedEnvelope): string {
    const keyDecipher = crypto.createDecipheriv('aes-256-ecb', this.masterKey, null);
    let dataKeyHex = keyDecipher.update(envelope.encryptedKey, 'hex', 'utf8');
    dataKeyHex += keyDecipher.final('utf8');
    const dataKey = Buffer.from(dataKeyHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', dataKey, Buffer.from(envelope.iv, 'hex'));
    let decrypted = decipher.update(envelope.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
