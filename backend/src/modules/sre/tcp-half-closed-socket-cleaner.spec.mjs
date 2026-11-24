import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TcpHalfClosedSocketCleanerService {
  clean(socks) {
    return socks.filter(s => s.state === 'CLOSE_WAIT' && s.idle > 10000).map(s => s.fd);
  }
}

describe('TcpHalfClosedSocketCleanerService (#2221)', () => {
  test('detects and reaps lingering half-closed CLOSE_WAIT sockets', () => {
    const cleaner = new TcpHalfClosedSocketCleanerService();
    const res = cleaner.clean([
      { fd: 10, state: 'ESTABLISHED', idle: 50000 },
      { fd: 11, state: 'CLOSE_WAIT', idle: 15000 },
      { fd: 12, state: 'CLOSE_WAIT', idle: 2000 },
    ]);
    assert.deepStrictEqual(res, [11]);
  });
});
