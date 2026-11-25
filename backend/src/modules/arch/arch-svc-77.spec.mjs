import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EnvelopeEncryptionProviderService } from './arch-svc-77.service.ts';

describe('EnvelopeEncryptionProviderService (ARCH-SVC-77)', () => {
  it('encrypts data using single-use data keys sealed by master key and decrypts successfully', () => {
    const provider = new EnvelopeEncryptionProviderService();
    const secret = 'DATABASE_PASSWORD=SuperSecretKey123';

    const envelope = provider.encrypt(secret);
    assert.notStrictEqual(envelope.encryptedData, secret);

    const decrypted = provider.decrypt(envelope);
    assert.strictEqual(decrypted, secret);
  });
});
