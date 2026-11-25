import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MtlsCertificateRotationDaemonService } from './arch-svc-49.service.ts';

describe('MtlsCertificateRotationDaemonService (ARCH-SVC-49)', () => {
  it('updates SSL/TLS context dynamically without terminating active sockets', () => {
    const daemon = new MtlsCertificateRotationDaemonService();
    daemon.rotateCertificate('cert-v1', 'key-v1');
    assert.strictEqual(daemon.getActiveCertificate()?.version, 1);

    daemon.rotateCertificate('cert-v2', 'key-v2');
    assert.strictEqual(daemon.getActiveCertificate()?.version, 2);
    assert.strictEqual(daemon.getActiveCertificate()?.certPem, 'cert-v2');
  });
});
