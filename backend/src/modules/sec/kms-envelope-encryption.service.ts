import crypto from 'crypto';

export interface EnvelopeCiphertext {
  encryptedDek: string;
  iv: string;
  ciphertext: string;
  authTag: string;
}

export class KMSEnvelopeEncryptionService {
  private masterKek: Buffer;

  constructor(masterKekHex: string = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') {
    this.masterKek = Buffer.from(masterKekHex, 'hex');
  }

  public encryptPayload(plaintext: string): EnvelopeCiphertext {
    // Generate random 256-bit DEK
    const dek = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    // Wrap DEK with master KEK
    const kekCipher = crypto.createCipheriv('aes-256-ecb', this.masterKek, null);
    let encryptedDek = kekCipher.update(dek.toString('hex'), 'utf8', 'hex');
    encryptedDek += kekCipher.final('hex');

    return {
      encryptedDek,
      iv: iv.toString('hex'),
      ciphertext,
      authTag
    };
  }

  public decryptPayload(envelope: EnvelopeCiphertext): string {
    // Unwrap DEK
    const kekDecipher = crypto.createDecipheriv('aes-256-ecb', this.masterKek, null);
    let dekHex = kekDecipher.update(envelope.encryptedDek, 'hex', 'utf8');
    dekHex += kekDecipher.final('utf8');
    const dek = Buffer.from(dekHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, Buffer.from(envelope.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'hex'));
    let plaintext = decipher.update(envelope.ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  }
}
