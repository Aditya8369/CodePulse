import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ZeroCopyStreamForwardingService } from './arch-svc-38.service.ts';

describe('ZeroCopyStreamForwardingService (ARCH-SVC-38)', () => {
  it('streams chunks through pipeline without intermediate buffer copies', async () => {
    const service = new ZeroCopyStreamForwardingService();
    const { input, output, transferredBytes } = service.createForwardingPipeline();

    const receivedChunks = [];
    output.on('data', chunk => receivedChunks.push(chunk));

    input.write(Buffer.from('hello '));
    input.write(Buffer.from('world'));
    input.end();

    await new Promise(r => output.on('end', r));
    assert.strictEqual(transferredBytes(), 11);
    assert.strictEqual(Buffer.concat(receivedChunks).toString('utf8'), 'hello world');
  });
});
