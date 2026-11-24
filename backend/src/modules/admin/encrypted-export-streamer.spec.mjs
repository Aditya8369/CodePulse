import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'crypto';

class EncryptedExportStreamerService {
  enc(chunk, keyHex) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
    let enc = cipher.update(chunk, 'utf8', 'hex');
    enc += cipher.final('hex');
    return { iv: iv.toString('hex'), enc, tag: cipher.getAuthTag().toString('hex') };
  }
}

describe('EncryptedExportStreamerService (#2384)', () => {
  test('encrypts data stream chunks using AES-256-GCM authenticated encryption', () => {
    const streamer = new EncryptedExportStreamerService();
    const key = crypto.randomBytes(32).toString('hex');
    const res = streamer.enc('sensitive export dataset records', key);

    assert.ok(res.enc.length > 0);
    assert.strictEqual(res.iv.length, 24); // 12 bytes
    assert.strictEqual(res.tag.length, 32); // 16 bytes
  });
});
