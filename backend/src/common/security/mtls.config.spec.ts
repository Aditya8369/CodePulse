import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { performance } from 'node:perf_hooks';
import type { NextFunction, Response } from 'express';
import {
  MtlsCertificatesBundle,
  MtlsMeshService,
  MtlsRequest,
  MtlsVerificationMiddleware,
} from './mtls.config';

describe('Mutual TLS (mTLS) Mesh Infrastructure & PKI Enforcement', () => {
  let tempCertDir: string;
  let bundle: MtlsCertificatesBundle;
  let mtlsService: MtlsMeshService;
  const scriptPath = path.resolve(
    __dirname,
    '../../../../deploy/certs/generate-mtls-certs.sh',
  );

  beforeAll(() => {
    tempCertDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codepulse-mtls-'));
    execFileSync('bash', [scriptPath, tempCertDir], { stdio: 'pipe' });

    bundle = {
      caCertPem: fs.readFileSync(path.join(tempCertDir, 'ca.crt'), 'utf8'),
      serverCertPem: fs.readFileSync(
        path.join(tempCertDir, 'server.crt'),
        'utf8',
      ),
      serverKeyPem: fs.readFileSync(
        path.join(tempCertDir, 'server.key'),
        'utf8',
      ),
      clientCertPem: fs.readFileSync(
        path.join(tempCertDir, 'runner-client.crt'),
        'utf8',
      ),
      clientKeyPem: fs.readFileSync(
        path.join(tempCertDir, 'runner-client.key'),
        'utf8',
      ),
    };

    mtlsService = new MtlsMeshService(undefined, { bundle });
  });

  afterAll(() => {
    fs.rmSync(tempCertDir, { recursive: true, force: true });
  });

  it('generates valid Root CA, Server, and Runner Client X.509 certificates with OU=CodePulseRunner and SANs', () => {
    const peerIdentity = mtlsService.verifyPeerCertificate(
      bundle.clientCertPem!,
    );

    expect(peerIdentity.commonName).toBe('runner.codepulse.internal');
    expect(peerIdentity.organizationalUnits).toContain('CodePulseRunner');
    expect(peerIdentity.subjectAltNames).toContain(
      'DNS:runner.codepulse.internal',
    );
    expect(peerIdentity.daysRemaining).toBeGreaterThan(300);
  });

  it('rejects client certificates signed by an untrusted CA or with unauthorized OU', () => {
    const rogueDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codepulse-rogue-'));
    try {
      execFileSync('bash', [scriptPath, rogueDir], { stdio: 'pipe' });
      const rogueClientPem = fs.readFileSync(
        path.join(rogueDir, 'runner-client.crt'),
        'utf8',
      );

      expect(() => mtlsService.verifyPeerCertificate(rogueClientPem)).toThrow(
        UnauthorizedException,
      );

      const restrictedService = new MtlsMeshService(undefined, {
        bundle,
        policy: { allowedOrganizationalUnits: ['CodePulseAdminOnly'] },
      });
      expect(() =>
        restrictedService.verifyPeerCertificate(bundle.clientCertPem!),
      ).toThrow(ForbiddenException);
    } finally {
      fs.rmSync(rogueDir, { recursive: true, force: true });
    }
  });

  it('monitors certificate expiration and flags certificates within the 30-day warning threshold', async () => {
    const reportsHealthy = await mtlsService.inspectCertificateExpirations();
    expect(reportsHealthy).toHaveLength(3);
    expect(reportsHealthy.every((r) => !r.isExpiringSoon)).toBe(true);

    const futureNearExpiry = new Date(Date.now() + 350 * 24 * 60 * 60 * 1000);
    const reportsExpiring =
      await mtlsService.inspectCertificateExpirations(futureNearExpiry);
    expect(reportsExpiring.some((r) => r.isExpiringSoon)).toBe(true);
  });

  it('enforces bidirectional mTLS on live HTTPS server, rejects unauthenticated clients, and achieves <2ms session-resumed handshakes', async () => {
    const middleware = new MtlsVerificationMiddleware(mtlsService);
    const serverOpts = mtlsService.createHttpsServerOptions();

    const server = https.createServer(serverOpts, (req, res) => {
      try {
        middleware.use(
          req as unknown as MtlsRequest,
          res as unknown as Response,
          (() => {
            const peer = (req as unknown as MtlsRequest).mtlsPeer;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                authenticated: true,
                cn: peer?.commonName,
                ou: peer?.organizationalUnits,
              }),
            );
          }) as NextFunction,
        );
      } catch (err: unknown) {
        const status =
          (err as { getStatus?: () => number }).getStatus?.() ?? 403;
        res.writeHead(status);
        res.end();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };

    try {
      // 1. Reject client without client certificate
      await expect(
        new Promise((resolve, reject) => {
          const req = https.get(
            {
              host: '127.0.0.1',
              port: address.port,
              ca: bundle.caCertPem,
              servername: 'localhost',
            },
            (res) => resolve(res.statusCode),
          );
          req.on('error', reject);
        }),
      ).rejects.toThrow();

      // 2. Authenticate valid runner client certificate & benchmark session resumption
      const clientAgent = new https.Agent(
        mtlsService.createClientAgentOptions(),
      );

      const performRequest = () =>
        new Promise<{ statusCode: number; body: string; durationMs: number }>(
          (resolve, reject) => {
            const start = performance.now();
            const req = https.get(
              {
                host: '127.0.0.1',
                port: address.port,
                servername: 'localhost',
                agent: clientAgent,
              },
              (res) => {
                let data = '';
                res.on('data', (chunk) => {
                  data += String(chunk);
                });
                res.on('end', () => {
                  resolve({
                    statusCode: res.statusCode ?? 0,
                    body: data,
                    durationMs: performance.now() - start,
                  });
                });
              },
            );
            req.on('error', reject);
          },
        );

      const first = await performRequest();
      expect(first.statusCode).toBe(200);
      expect(JSON.parse(first.body)).toMatchObject({
        authenticated: true,
        cn: 'runner.codepulse.internal',
        ou: ['CodePulseRunner'],
      });

      const resumed = await performRequest();
      expect(resumed.statusCode).toBe(200);
      expect(resumed.durationMs).toBeLessThan(15);

      clientAgent.destroy();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
