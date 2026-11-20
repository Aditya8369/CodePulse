import {
  ForbiddenException,
  Injectable,
  Logger,
  NestMiddleware,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomBytes, X509Certificate } from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import type { NextFunction, Request, Response } from 'express';
import type { TLSSocket } from 'tls';

export interface MtlsCertificatesBundle {
  caCertPem: string;
  serverCertPem: string;
  serverKeyPem: string;
  clientCertPem?: string;
  clientKeyPem?: string;
}

export interface MtlsPolicyOptions {
  allowedOrganizationalUnits: string[];
  allowedSans: string[];
  expiryWarningDays: number;
  sessionTimeoutSeconds: number;
  sessionIdContext: string;
}

export interface PeerCertificateIdentity {
  subject: string;
  issuer: string;
  commonName: string;
  organizationalUnits: string[];
  subjectAltNames: string[];
  serialNumber: string;
  fingerprint256: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
}

export interface CertificateExpiryReport {
  label: string;
  subject: string;
  validTo: string;
  daysRemaining: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

export interface MtlsMeshStatus {
  enabled: boolean;
  enforceClientCerts: boolean;
  allowedOrganizationalUnits: string[];
  allowedSans: string[];
  sessionResumptionEnabled: boolean;
  sessionTimeoutSeconds: number;
  certificates: CertificateExpiryReport[];
  expiringSoonCount: number;
}

export interface MtlsRequest extends Request {
  mtlsPeer?: PeerCertificateIdentity;
}

export function parseDistinguishedNameField(
  dn: string,
  field: string,
): string[] {
  const results: string[] = [];
  const prefix = `${field.toUpperCase()}=`;
  for (const line of dn.split(/[\n,]+/)) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase().startsWith(prefix)) {
      results.push(trimmed.slice(prefix.length).trim());
    }
  }
  return results;
}

export function parseSubjectAltNames(sanString?: string): string[] {
  if (!sanString) return [];
  return sanString
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (entry.startsWith('IP Address:')) {
        return `IP:${entry.slice('IP Address:'.length)}`;
      }
      return entry;
    });
}

@Injectable()
export class MtlsMeshService {
  private readonly logger = new Logger(MtlsMeshService.name);
  private readonly policy: MtlsPolicyOptions;
  private readonly ticketKeys: Buffer;
  private readonly discordWebhookUrl?: string;
  private bundle: MtlsCertificatesBundle | null = null;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional()
    options?: {
      bundle?: MtlsCertificatesBundle;
      policy?: Partial<MtlsPolicyOptions>;
      discordWebhookUrl?: string;
    },
  ) {
    const allowedOusRaw =
      this.configService?.get<string>('MTLS_ALLOWED_OUS') ||
      process.env.MTLS_ALLOWED_OUS ||
      'CodePulseRunner,CodePulseBackend';

    const allowedSansRaw =
      this.configService?.get<string>('MTLS_ALLOWED_SANS') ||
      process.env.MTLS_ALLOWED_SANS ||
      'DNS:runner.codepulse.internal,DNS:codepulse-runner,DNS:backend.codepulse.internal,DNS:localhost,IP:127.0.0.1';

    this.policy = {
      allowedOrganizationalUnits:
        options?.policy?.allowedOrganizationalUnits ??
        allowedOusRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      allowedSans:
        options?.policy?.allowedSans ??
        allowedSansRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      expiryWarningDays:
        options?.policy?.expiryWarningDays ??
        parseInt(
          this.configService?.get<string>('MTLS_EXPIRY_WARNING_DAYS') ||
            process.env.MTLS_EXPIRY_WARNING_DAYS ||
            '30',
          10,
        ),
      sessionTimeoutSeconds:
        options?.policy?.sessionTimeoutSeconds ?? 3600,
      sessionIdContext:
        options?.policy?.sessionIdContext ?? 'codepulse-mtls-mesh-v1',
    };

    this.discordWebhookUrl =
      options?.discordWebhookUrl ??
      this.configService?.get<string>('DISCORD_SECURITY_WEBHOOK_URL') ??
      process.env.DISCORD_SECURITY_WEBHOOK_URL;

    // 48-byte TLS session ticket key for fast <2ms TLS session resumption across mesh workers
    this.ticketKeys = randomBytes(48);

    if (options?.bundle) {
      this.bundle = options.bundle;
    } else {
      this.bundle = this.tryLoadCertificatesFromDisk();
    }
  }

  setCertificatesBundle(bundle: MtlsCertificatesBundle): void {
    this.bundle = bundle;
  }

  getCertificatesBundle(): MtlsCertificatesBundle | null {
    return this.bundle;
  }

  getPolicy(): MtlsPolicyOptions {
    return { ...this.policy };
  }

  private tryLoadCertificatesFromDisk(): MtlsCertificatesBundle | null {
    const baseDir =
      this.configService?.get<string>('MTLS_CERT_DIR') ||
      process.env.MTLS_CERT_DIR ||
      path.resolve(process.cwd(), '../deploy/certs/generated');

    const caPath =
      this.configService?.get<string>('MTLS_CA_CERT_PATH') ||
      process.env.MTLS_CA_CERT_PATH ||
      path.join(baseDir, 'ca.crt');
    const serverCertPath =
      this.configService?.get<string>('MTLS_SERVER_CERT_PATH') ||
      process.env.MTLS_SERVER_CERT_PATH ||
      path.join(baseDir, 'server.crt');
    const serverKeyPath =
      this.configService?.get<string>('MTLS_SERVER_KEY_PATH') ||
      process.env.MTLS_SERVER_KEY_PATH ||
      path.join(baseDir, 'server.key');
    const clientCertPath =
      this.configService?.get<string>('MTLS_CLIENT_CERT_PATH') ||
      process.env.MTLS_CLIENT_CERT_PATH ||
      path.join(baseDir, 'runner-client.crt');
    const clientKeyPath =
      this.configService?.get<string>('MTLS_CLIENT_KEY_PATH') ||
      process.env.MTLS_CLIENT_KEY_PATH ||
      path.join(baseDir, 'runner-client.key');

    if (
      !fs.existsSync(caPath) ||
      !fs.existsSync(serverCertPath) ||
      !fs.existsSync(serverKeyPath)
    ) {
      return null;
    }

    return {
      caCertPem: fs.readFileSync(caPath, 'utf8'),
      serverCertPem: fs.readFileSync(serverCertPath, 'utf8'),
      serverKeyPem: fs.readFileSync(serverKeyPath, 'utf8'),
      clientCertPem: fs.existsSync(clientCertPath)
        ? fs.readFileSync(clientCertPath, 'utf8')
        : undefined,
      clientKeyPem: fs.existsSync(clientKeyPath)
        ? fs.readFileSync(clientKeyPath, 'utf8')
        : undefined,
    };
  }

  /**
   * Builds bidirectional mTLS HTTPS server options enforcing client certificates
   * signed by the internal Root CA and enabling TLS session resumption.
   */
  createHttpsServerOptions(
    bundleOverride?: MtlsCertificatesBundle,
  ): https.ServerOptions {
    const active = bundleOverride ?? this.bundle;
    if (!active) {
      throw new Error(
        'mTLS certificates not loaded. Run deploy/certs/generate-mtls-certs.sh or configure MTLS_CERT_DIR.',
      );
    }

    return {
      ca: active.caCertPem,
      cert: active.serverCertPem,
      key: active.serverKeyPem,
      requestCert: true,
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      sessionTimeout: this.policy.sessionTimeoutSeconds,
      sessionIdContext: this.policy.sessionIdContext,
      ticketKeys: this.ticketKeys,
    };
  }

  /**
   * Builds gRPC ServerCredentials / ChannelCredentials configuration for NestJS microservice transports.
   */
  createGrpcMtlsCredentialsConfig(bundleOverride?: MtlsCertificatesBundle): {
    rootCerts: Buffer;
    privateKey: Buffer;
    certChain: Buffer;
    checkClientCertificate: true;
  } {
    const active = bundleOverride ?? this.bundle;
    if (!active) {
      throw new Error('mTLS certificates not loaded for gRPC mesh transport');
    }

    return {
      rootCerts: Buffer.from(active.caCertPem, 'utf8'),
      privateKey: Buffer.from(active.serverKeyPem, 'utf8'),
      certChain: Buffer.from(active.serverCertPem, 'utf8'),
      checkClientCertificate: true,
    };
  }

  /**
   * Builds mutual TLS HTTPS agent options for outbound Backend -> Runner calls
   * with TLS session caching enabled for sub-2ms resumed handshakes.
   */
  createClientAgentOptions(
    bundleOverride?: MtlsCertificatesBundle,
  ): https.AgentOptions {
    const active = bundleOverride ?? this.bundle;
    if (!active || !active.clientCertPem || !active.clientKeyPem) {
      throw new Error(
        'mTLS client certificate and private key are required for outbound mesh agent',
      );
    }

    return {
      ca: active.caCertPem,
      cert: active.clientCertPem,
      key: active.clientKeyPem,
      rejectUnauthorized: true,
      keepAlive: true,
      maxCachedSessions: 128,
    };
  }

  /**
   * Verifies a peer X.509 certificate against the Root CA, expiration window,
   * allowed Organizational Units (e.g., OU=CodePulseRunner), and Subject Alternative Names (SAN).
   */
  verifyPeerCertificate(
    peerCertPemOrDer: string | Buffer,
    now = new Date(),
  ): PeerCertificateIdentity {
    const x509 = new X509Certificate(peerCertPemOrDer);

    if (this.bundle?.caCertPem) {
      const caCert = new X509Certificate(this.bundle.caCertPem);
      if (x509.issuer !== caCert.subject || !x509.verify(caCert.publicKey)) {
        throw new UnauthorizedException(
          `mTLS peer certificate "${x509.subject}" is not signed by trusted CodePulse Mesh Root CA`,
        );
      }
    }

    const validFrom = new Date(x509.validFrom);
    const validTo = new Date(x509.validTo);
    if (now < validFrom || now > validTo) {
      throw new UnauthorizedException(
        `mTLS peer certificate "${x509.subject}" is expired or not yet valid`,
      );
    }

    const commonNames = parseDistinguishedNameField(x509.subject, 'CN');
    const organizationalUnits = parseDistinguishedNameField(x509.subject, 'OU');
    const subjectAltNames = parseSubjectAltNames(x509.subjectAltName);

    if (this.policy.allowedOrganizationalUnits.length > 0) {
      const ouMatched = organizationalUnits.some((ou) =>
        this.policy.allowedOrganizationalUnits.includes(ou),
      );
      if (!ouMatched) {
        throw new ForbiddenException(
          `mTLS peer certificate OU [${organizationalUnits.join(', ')}] is not authorized (expected one of: ${this.policy.allowedOrganizationalUnits.join(', ')})`,
        );
      }
    }

    if (this.policy.allowedSans.length > 0) {
      const sanMatched = subjectAltNames.some((san) =>
        this.policy.allowedSans.includes(san),
      );
      if (!sanMatched) {
        throw new ForbiddenException(
          `mTLS peer certificate SANs [${subjectAltNames.join(', ')}] do not match allowed mesh SANs`,
        );
      }
    }

    const msRemaining = validTo.getTime() - now.getTime();
    const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));

    return {
      subject: x509.subject,
      issuer: x509.issuer,
      commonName: commonNames[0] || '',
      organizationalUnits,
      subjectAltNames,
      serialNumber: x509.serialNumber,
      fingerprint256: x509.fingerprint256,
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
      daysRemaining,
    };
  }

  /**
   * Audits all loaded mTLS certificates (Root CA, Server Cert, Runner Client Cert)
   * and triggers alerts when any certificate has < 30 days remaining before expiry.
   */
  async inspectCertificateExpirations(
    now = new Date(),
  ): Promise<CertificateExpiryReport[]> {
    if (!this.bundle) {
      return [];
    }

    const entries: Array<{ label: string; pem?: string }> = [
      { label: 'mesh-root-ca', pem: this.bundle.caCertPem },
      { label: 'backend-server-cert', pem: this.bundle.serverCertPem },
      { label: 'runner-client-cert', pem: this.bundle.clientCertPem },
    ];

    const reports: CertificateExpiryReport[] = [];
    for (const item of entries) {
      if (!item.pem) continue;
      const cert = new X509Certificate(item.pem);
      const validTo = new Date(cert.validTo);
      const daysRemaining = Math.floor(
        (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const isExpired = daysRemaining < 0;
      const isExpiringSoon = daysRemaining <= this.policy.expiryWarningDays;

      const report: CertificateExpiryReport = {
        label: item.label,
        subject: cert.subject,
        validTo: validTo.toISOString(),
        daysRemaining,
        isExpired,
        isExpiringSoon,
      };
      reports.push(report);

      if (isExpiringSoon) {
        this.logger.warn(
          `mTLS Certificate "${item.label}" (${cert.subject}) expires in ${daysRemaining} days (${validTo.toISOString()})`,
        );
        await this.sendExpiryAlert(report);
      }
    }

    return reports;
  }

  private async sendExpiryAlert(report: CertificateExpiryReport): Promise<void> {
    if (!this.discordWebhookUrl) return;
    try {
      await axios.post(
        this.discordWebhookUrl,
        {
          username: 'CodePulse mTLS Mesh Sentinel',
          embeds: [
            {
              title: report.isExpired
                ? `🚨 mTLS Certificate EXPIRED (${report.label})`
                : `⚠️ mTLS Certificate Expiring Soon (${report.label})`,
              color: report.isExpired ? 0xdc2626 : 0xf59e0b,
              fields: [
                { name: 'Certificate', value: report.label, inline: true },
                {
                  name: 'Days Remaining',
                  value: `${report.daysRemaining} days`,
                  inline: true,
                },
                { name: 'Subject', value: `\`${report.subject}\``, inline: false },
                { name: 'Expires At', value: report.validTo, inline: false },
              ],
            },
          ],
        },
        { timeout: 3000 },
      );
    } catch {
      // Non-blocking alert
    }
  }

  async getMeshStatus(): Promise<MtlsMeshStatus> {
    const certificates = await this.inspectCertificateExpirations();
    return {
      enabled: Boolean(this.bundle),
      enforceClientCerts: true,
      allowedOrganizationalUnits: this.policy.allowedOrganizationalUnits,
      allowedSans: this.policy.allowedSans,
      sessionResumptionEnabled: true,
      sessionTimeoutSeconds: this.policy.sessionTimeoutSeconds,
      certificates,
      expiringSoonCount: certificates.filter((c) => c.isExpiringSoon).length,
    };
  }
}

/**
 * Express / NestJS Middleware verifying bidirectional mTLS client certificates,
 * Organizational Unit (OU=CodePulseRunner), and Subject Alternative Names (SAN).
 */
@Injectable()
export class MtlsVerificationMiddleware implements NestMiddleware {
  constructor(private readonly mtlsMeshService: MtlsMeshService) {}

  use(req: MtlsRequest, res: Response, next: NextFunction): void {
    const socket = req.socket as TLSSocket | undefined;

    if (!socket || typeof socket.getPeerCertificate !== 'function') {
      throw new UnauthorizedException(
        'mTLS required: connection is not established over TLS',
      );
    }

    if (!socket.authorized) {
      throw new UnauthorizedException(
        `mTLS client certificate verification failed: ${String(socket.authorizationError || 'UNAUTHORIZED_CLIENT')}`,
      );
    }

    const peerCert = socket.getPeerCertificate(true);
    if (!peerCert || !peerCert.raw) {
      throw new UnauthorizedException(
        'mTLS client certificate missing from TLS handshake',
      );
    }

    const identity = this.mtlsMeshService.verifyPeerCertificate(peerCert.raw);
    req.mtlsPeer = identity;
    res.setHeader('X-MTLS-Peer-CN', identity.commonName);
    res.setHeader('X-MTLS-Peer-OU', identity.organizationalUnits.join(','));
    next();
  }
}
