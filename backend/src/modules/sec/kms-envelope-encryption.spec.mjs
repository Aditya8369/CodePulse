import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

class KMSEnvelopeEncryptionService {
  constructor(kekHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') {
    this.kek = Buffer.from(kekHex, 'hex');
  }
  encryptPayload(plain) {
    const dek = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    let c = cipher.update(plain, 'utf8', 'hex') + cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    const kCipher = crypto.createCipheriv('aes-256-ecb', this.kek, null);
    const encDek = kCipher.update(dek.toString('hex'), 'utf8', 'hex') + kCipher.final('hex');
    return { encryptedDek: encDek, iv: iv.toString('hex'), ciphertext: c, authTag: tag };
  }
  decryptPayload(env) {
    const kDecipher = crypto.createDecipheriv('aes-256-ecb', this.kek, null);
    const dek = Buffer.from(kDecipher.update(env.encryptedDek, 'hex', 'utf8') + kDecipher.final('utf8'), 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, Buffer.from(env.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(env.authTag, 'hex'));
    return decipher.update(env.ciphertext, 'hex', 'utf8') + decipher.final('utf8');
  }
}

describe('KMSEnvelopeEncryptionService (Issue #1841)', () => {
  it('should encrypt with ephemeral DEK and successfully unwrap and decrypt with KEK', () => {
    const kms = new KMSEnvelopeEncryptionService();
    const original = 'confidential-source-code-payload-xyz';
    const envelope = kms.encryptPayload(original);

    assert.notEqual(envelope.ciphertext, original);
    const decrypted = kms.decryptPayload(envelope);
    assert.equal(decrypted, original);
  });
});
