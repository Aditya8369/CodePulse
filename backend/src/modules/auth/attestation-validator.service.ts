import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  createHash,
  createPublicKey,
  createVerify,
  KeyObject,
  X509Certificate,
} from 'crypto';
import Redis from 'ioredis';

export type SupportedAttestationFormat =
  | 'packed'
  | 'fido-u2f'
  | 'tpm'
  | 'none';

export type AttestationTrustLevel =
  | 'fido-hardware-ca'
  | 'self-attested'
  | 'none';

export interface AuthenticatorHardwareMetadata {
  aaguid: string;
  modelName: string;
  vendor: string;
  isHardwareToken: boolean;
  fidoCertificationLevel?: 'L1' | 'L2' | 'L3' | 'U2F';
  transports?: string[];
  source: 'fido-mds3' | 'builtin-registry' | 'unknown';
}

export interface FidoMds3CachePayload {
  fetchedAt: string;
  nextUpdate?: string;
  rootCertificatesPem: string[];
  metadataByAaguid: Record<string, AuthenticatorHardwareMetadata>;
}

export interface ParsedAuthenticatorData {
  rpIdHash: Buffer;
  flags: {
    raw: number;
    userPresent: boolean;
    userVerified: boolean;
    attestedCredentialData: boolean;
    extensionDataIncluded: boolean;
  };
  signCount: number;
  aaguid: string;
  aaguidBytes: Buffer;
  credentialId?: Buffer;
  credentialPublicKeyCbor?: Buffer;
  coseKey?: CosePublicKey;
}

export interface CosePublicKey {
  kty: number;
  alg: number;
  crv?: number;
  x?: Buffer;
  y?: Buffer;
  n?: Buffer;
  e?: Buffer;
}

export interface WebAuthnAttestationInput {
  attestationObject: Buffer | string;
  clientDataJSON: Buffer | string;
  expectedOrigin?: string;
  expectedRpId?: string;
  expectedChallenge?: string;
}

export interface AttestationValidationResult {
  valid: boolean;
  format: SupportedAttestationFormat;
  trustLevel: AttestationTrustLevel;
  isHardwareBacked: boolean;
  aaguid: string;
  hardwareModel: AuthenticatorHardwareMetadata;
  credentialId: string;
  credentialPublicKeyPem: string;
  credentialPublicKeyCoseHex: string;
  signCount: number;
  userVerified: boolean;
  rootCaSubject?: string;
  certificateChainSubjects?: string[];
  reason?: string;
}

export interface OrganizationHardwarePolicy {
  organizationId?: string;
  requireHardwareAttestation: boolean;
  enforceForAdminRoles: boolean;
  adminRoles: string[];
  allowedAaguids?: string[];
  requireUserVerification?: boolean;
}

export interface HardwarePolicyEvaluation {
  allowed: boolean;
  reason?: string;
}

export interface MdsRedisLike {
  status?: string;
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    ttlSeconds: number,
  ): Promise<'OK' | null>;
  disconnect(): void;
}

// OID 1.3.6.1.4.1.45724.1.1.4 (id-fido-gen-ce-aaguid) DER tag+length+value prefix
const FIDO_AAGUID_OID_DER = Buffer.from([
  0x06, 0x0b, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x82, 0xe5, 0x1c, 0x01, 0x01, 0x04,
]);

// TPM 2.0 constants (TCG TPM 2.0 Library Specification)
const TPM_GENERATED_VALUE = 0xff544347;
const TPM_ST_ATTEST_CERTIFY = 0x8017;
const TPM_ALG_RSA = 0x0001;
const TPM_ALG_SHA1 = 0x0004;
const TPM_ALG_SHA256 = 0x000b;
const TPM_ALG_SHA384 = 0x000c;
const TPM_ALG_SHA512 = 0x000d;
const TPM_ALG_ECC = 0x0023;
const TPM_ECC_NIST_P256 = 0x0003;
const TPM_ECC_NIST_P384 = 0x0004;

const ZERO_AAGUID = '00000000-0000-0000-0000-000000000000';

/**
 * Curated FIDO2 / U2F Hardware Security Token AAGUID Registry
 * (supplemented dynamically by FIDO Alliance Metadata Service MDS3).
 */
export const KNOWN_HARDWARE_AUTHENTICATORS: Record<
  string,
  Omit<AuthenticatorHardwareMetadata, 'aaguid' | 'source'>
> = {
  'fa2b99dc-9e39-4257-8f92-4a30d23c4118': {
    modelName: 'YubiKey 5 NFC',
    vendor: 'Yubico',
    isHardwareToken: true,
    fidoCertificationLevel: 'L1',
    transports: ['usb', 'nfc'],
  },
  'd7781e5d-e353-46aa-afe2-3ca49f13332a': {
    modelName: 'YubiKey 5 NFC (Firmware 5.4+)',
    vendor: 'Yubico',
    isHardwareToken: true,
    fidoCertificationLevel: 'L1',
    transports: ['usb', 'nfc'],
  },
  '19083c3d-8383-4b18-bc03-8f1c9ab2fd1b': {
    modelName: 'YubiKey 5 Series (Firmware 5.7)',
    vendor: 'Yubico',
    isHardwareToken: true,
    fidoCertificationLevel: 'L2',
    transports: ['usb', 'nfc'],
  },
  '2fc0579f-8113-47ea-b116-bb5a8db9202a': {
    modelName: 'YubiKey 5Ci',
    vendor: 'Yubico',
    isHardwareToken: true,
    fidoCertificationLevel: 'L1',
    transports: ['usb', 'lightning'],
  },
  'cb69481e-8ff7-4039-93ec-0a2729a154a8': {
    modelName: 'YubiKey 5 Series',
    vendor: 'Yubico',
    isHardwareToken: true,
    fidoCertificationLevel: 'L1',
    transports: ['usb', 'nfc'],
  },
  'ee882879-721c-4913-9775-3dfcce97072a': {
    modelName: 'YubiKey 5 FIPS Series',
    vendor: 'Yubico',
    isHardwareToken: true,
    fidoCertificationLevel: 'L2',
    transports: ['usb', 'nfc'],
  },
  'c1f9a0bc-1dd2-404a-b27f-8e29047a43fd': {
    modelName: 'YubiKey Bio Series',
    vendor: 'Yubico',
    isHardwareToken: true,
    fidoCertificationLevel: 'L2',
    transports: ['usb'],
  },
  '73bb0cd4-e502-49b8-9c6f-b59445bf720b': {
    modelName: 'YubiKey 5 NFC FIPS',
    vendor: 'Yubico',
    isHardwareToken: true,
    fidoCertificationLevel: 'L2',
    transports: ['usb', 'nfc'],
  },
  'f8a011f3-8c0a-4d15-8006-17111f9edc7d': {
    modelName: 'Security Key by Yubico',
    vendor: 'Yubico',
    isHardwareToken: true,
    fidoCertificationLevel: 'L1',
    transports: ['usb', 'nfc'],
  },
  'a4e9fc6d-4cbe-4758-b8ba-37598bb5bbaa': {
    modelName: 'Security Key NFC by Yubico',
    vendor: 'Yubico',
    isHardwareToken: true,
    fidoCertificationLevel: 'L1',
    transports: ['usb', 'nfc'],
  },
  '42b4fb4a-2866-43b2-9bf7-6c6669c2e5d3': {
    modelName: 'Google Titan Security Key',
    vendor: 'Google',
    isHardwareToken: true,
    fidoCertificationLevel: 'L1',
    transports: ['usb', 'nfc', 'ble'],
  },
  '8836336a-f590-0921-301d-46427531eee6': {
    modelName: 'Google Titan Security Key v2',
    vendor: 'Google',
    isHardwareToken: true,
    fidoCertificationLevel: 'L2',
    transports: ['usb', 'nfc'],
  },
  '8876631b-d4a0-427f-5773-0ec71c9e0279': {
    modelName: 'SoloKeys Solo 2',
    vendor: 'SoloKeys',
    isHardwareToken: true,
    fidoCertificationLevel: 'L1',
    transports: ['usb', 'nfc'],
  },
  'a94d6657-e427-4361-a6e2-6b28f07f57d7': {
    modelName: 'Nitrokey 3',
    vendor: 'Nitrokey',
    isHardwareToken: true,
    fidoCertificationLevel: 'L1',
    transports: ['usb', 'nfc'],
  },
  '77010bd7-212a-4fc9-b236-d2ca5e9d4084': {
    modelName: 'Feitian ePass FIDO2',
    vendor: 'Feitian',
    isHardwareToken: true,
    fidoCertificationLevel: 'L1',
    transports: ['usb', 'nfc'],
  },
  '08987058-cadc-4b81-b6e1-30de50dcbe96': {
    modelName: 'Windows Hello Hardware TPM',
    vendor: 'Microsoft',
    isHardwareToken: true,
    fidoCertificationLevel: 'L1',
    transports: ['internal'],
  },
};

@Injectable()
export class AttestationValidatorService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AttestationValidatorService.name);
  private readonly mdsCacheKey = 'fido:mds3:root-cas';
  private readonly mdsCacheTtlSeconds: number;
  private readonly mds3Url: string;
  private readonly disableRedis: boolean;

  private redisClient: MdsRedisLike | null = null;
  private trustedRootCAs = new Map<string, X509Certificate>();
  private mdsMetadataByAaguid = new Map<
    string,
    AuthenticatorHardwareMetadata
  >();
  private mdsLastFetchedAt: string | null = null;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional()
    options?: {
      mds3Url?: string;
      mdsCacheTtlSeconds?: number;
      disableRedis?: boolean;
    },
  ) {
    this.mds3Url =
      options?.mds3Url ||
      this.configService?.get<string>('FIDO_MDS3_URL') ||
      process.env.FIDO_MDS3_URL ||
      'https://mds3.fidoalliance.org/';

    this.mdsCacheTtlSeconds =
      options?.mdsCacheTtlSeconds ??
      parseInt(
        this.configService?.get<string>('FIDO_MDS3_CACHE_TTL_SECONDS') ||
          process.env.FIDO_MDS3_CACHE_TTL_SECONDS ||
          '86400',
        10,
      );

    this.disableRedis =
      options?.disableRedis ?? process.env.NODE_ENV === 'test';
  }

  onModuleInit(): void {
    if (this.disableRedis) {
      return;
    }

    const host =
      this.configService?.get<string>('REDIS_HOST') ||
      process.env.REDIS_HOST ||
      'localhost';
    const port = parseInt(
      this.configService?.get<string>('REDIS_PORT') ||
        process.env.REDIS_PORT ||
        '6379',
      10,
    );
    const password =
      this.configService?.get<string>('REDIS_PASSWORD') ||
      process.env.REDIS_PASSWORD ||
      undefined;

    try {
      const client = new Redis({
        host,
        port,
        password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
        enableOfflineQueue: false,
        retryStrategy: () => null,
      });

      client.on('error', () => {
        this.redisClient = null;
      });

      client
        .connect()
        .then(async () => {
          this.redisClient = client as unknown as MdsRedisLike;
          await this.loadMdsFromCacheOrRemote(false);
        })
        .catch(() => {
          this.logger.warn(
            'Redis unavailable for FIDO MDS3 Root CA cache; using in-memory trust store.',
          );
          this.redisClient = null;
        });
    } catch {
      this.redisClient = null;
    }
  }

  onModuleDestroy(): void {
    if (this.redisClient) {
      try {
        this.redisClient.disconnect();
      } catch {
        // Ignore disconnect errors on shutdown
      }
      this.redisClient = null;
    }
  }

  setRedisClient(client: MdsRedisLike | null): void {
    this.redisClient = client;
  }

  registerTrustedRootCa(certPemOrDer: string | Buffer): X509Certificate {
    const x509 = new X509Certificate(certPemOrDer);
    this.trustedRootCAs.set(x509.fingerprint256, x509);
    return x509;
  }

  clearTrustedRootCAs(): void {
    this.trustedRootCAs.clear();
  }

  getTrustedRootCAs(): X509Certificate[] {
    return Array.from(this.trustedRootCAs.values());
  }

  async loadMdsFromCacheOrRemote(
    forceRefresh = false,
  ): Promise<FidoMds3CachePayload> {
    if (!forceRefresh && this.redisClient) {
      try {
        const cachedJson = await this.redisClient.get(this.mdsCacheKey);
        if (cachedJson) {
          const parsed = JSON.parse(cachedJson) as FidoMds3CachePayload;
          this.applyMdsPayload(parsed);
          return parsed;
        }
      } catch {
        // Fall through to remote fetch
      }
    }

    const response = await axios.get<string>(this.mds3Url, {
      timeout: 10_000,
      responseType: 'text',
    });

    const payload = this.parseFidoMds3JwtBlob(response.data);
    this.applyMdsPayload(payload);

    if (this.redisClient) {
      try {
        await this.redisClient.set(
          this.mdsCacheKey,
          JSON.stringify(payload),
          'EX',
          this.mdsCacheTtlSeconds,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to cache FIDO MDS3 bundle in Redis: ${msg}`);
      }
    }

    return payload;
  }

  parseFidoMds3JwtBlob(jwtBlob: string): FidoMds3CachePayload {
    const segments = jwtBlob.trim().split('.');
    if (segments.length < 2) {
      throw new Error('Malformed FIDO MDS3 JWT BLOB');
    }

    const payloadJson = Buffer.from(segments[1], 'base64url').toString('utf8');
    const decoded = JSON.parse(payloadJson) as {
      nextUpdate?: string;
      entries?: Array<{
        aaguid?: string;
        metadataStatement?: {
          aaguid?: string;
          description?: string;
          attestationRootCertificates?: string[];
          authenticatorGetInfo?: { transports?: string[] };
        };
        statusReports?: Array<{ status?: string }>;
      }>;
    };

    const rootCertSet = new Set<string>();
    const metadataByAaguid: Record<string, AuthenticatorHardwareMetadata> = {};

    for (const entry of decoded.entries ?? []) {
      const stmt = entry.metadataStatement;
      if (!stmt) continue;

      for (const base64Der of stmt.attestationRootCertificates ?? []) {
        const cleanB64 = base64Der.replace(/\s+/g, '');
        if (!cleanB64) continue;
        const pem = derToPem(Buffer.from(cleanB64, 'base64'));
        rootCertSet.add(pem);
      }

      const rawAaguid = (entry.aaguid || stmt.aaguid || '').toLowerCase();
      if (rawAaguid && rawAaguid !== ZERO_AAGUID) {
        const desc = stmt.description || 'FIDO2 Hardware Security Key';
        const vendor = desc.split(' ')[0] || 'FIDO Certified';
        const latestStatus =
          entry.statusReports?.[entry.statusReports.length - 1]?.status || '';
        const certLevel = latestStatus.includes('L2')
          ? 'L2'
          : latestStatus.includes('L3')
            ? 'L3'
            : 'L1';

        metadataByAaguid[rawAaguid] = {
          aaguid: rawAaguid,
          modelName: desc,
          vendor,
          isHardwareToken: true,
          fidoCertificationLevel: certLevel,
          transports: stmt.authenticatorGetInfo?.transports,
          source: 'fido-mds3',
        };
      }
    }

    return {
      fetchedAt: new Date().toISOString(),
      nextUpdate: decoded.nextUpdate,
      rootCertificatesPem: Array.from(rootCertSet),
      metadataByAaguid,
    };
  }

  private applyMdsPayload(payload: FidoMds3CachePayload): void {
    for (const pem of payload.rootCertificatesPem ?? []) {
      try {
        this.registerTrustedRootCa(pem);
      } catch {
        // Skip malformed root entries
      }
    }

    for (const [aaguid, meta] of Object.entries(
      payload.metadataByAaguid ?? {},
    )) {
      this.mdsMetadataByAaguid.set(aaguid.toLowerCase(), meta);
    }

    this.mdsLastFetchedAt = payload.fetchedAt;
  }

  getMdsStatus() {
    return {
      trustedRootCaCount: this.trustedRootCAs.size,
      mdsEntriesCount: this.mdsMetadataByAaguid.size,
      lastFetchedAt: this.mdsLastFetchedAt,
      cacheKey: this.mdsCacheKey,
      cacheTtlSeconds: this.mdsCacheTtlSeconds,
    };
  }

  lookupHardwareByAaguid(
    aaguid: string,
    isHardwareBacked = false,
  ): AuthenticatorHardwareMetadata {
    const normalized = aaguid.toLowerCase();

    const mdsMatch = this.mdsMetadataByAaguid.get(normalized);
    if (mdsMatch) {
      return mdsMatch;
    }

    const builtinMatch = KNOWN_HARDWARE_AUTHENTICATORS[normalized];
    if (builtinMatch) {
      return {
        aaguid: normalized,
        ...builtinMatch,
        source: 'builtin-registry',
      };
    }

    if (normalized === ZERO_AAGUID) {
      return {
        aaguid: normalized,
        modelName: isHardwareBacked
          ? 'FIDO U2F Hardware Security Key'
          : 'Unattested / Platform Software Passkey',
        vendor: isHardwareBacked ? 'FIDO U2F' : 'Software / Platform',
        isHardwareToken: isHardwareBacked,
        fidoCertificationLevel: isHardwareBacked ? 'U2F' : undefined,
        source: 'unknown',
      };
    }

    return {
      aaguid: normalized,
      modelName: isHardwareBacked
        ? 'FIDO2 Hardware Authenticator'
        : 'Software / Platform Authenticator',
      vendor: isHardwareBacked ? 'FIDO2 Certified' : 'Unknown',
      isHardwareToken: isHardwareBacked,
      source: 'unknown',
    };
  }

  async validateAttestation(
    input: WebAuthnAttestationInput,
  ): Promise<AttestationValidationResult> {
    const attObjBuffer = toBuffer(input.attestationObject);
    const clientDataBuffer = toBuffer(input.clientDataJSON);

    let clientData: {
      type?: string;
      challenge?: string;
      origin?: string;
    };
    try {
      clientData = JSON.parse(clientDataBuffer.toString('utf8')) as {
        type?: string;
        challenge?: string;
        origin?: string;
      };
    } catch {
      throw new Error('Invalid clientDataJSON: unable to parse JSON');
    }

    if (clientData.type !== 'webauthn.create') {
      throw new Error(
        `Invalid clientDataJSON.type "${String(clientData.type)}": expected "webauthn.create"`,
      );
    }

    if (
      input.expectedChallenge &&
      clientData.challenge !== input.expectedChallenge
    ) {
      throw new Error('WebAuthn challenge mismatch in clientDataJSON');
    }

    if (input.expectedOrigin && clientData.origin !== input.expectedOrigin) {
      throw new Error(
        `WebAuthn origin mismatch: received "${String(clientData.origin)}", expected "${input.expectedOrigin}"`,
      );
    }

    const decodedAttObj = decodeCbor(attObjBuffer) as Record<string, unknown>;
    if (!decodedAttObj || typeof decodedAttObj !== 'object') {
      throw new Error('Invalid CBOR attestationObject');
    }

    const fmt = String(decodedAttObj.fmt || '') as SupportedAttestationFormat;
    const authDataRaw = decodedAttObj.authData;
    const attStmt = (decodedAttObj.attStmt ?? {}) as Record<string, unknown>;

    if (!Buffer.isBuffer(authDataRaw)) {
      throw new Error('Missing binary authData in attestationObject');
    }

    const parsedAuthData = this.parseAuthenticatorData(authDataRaw);
    if (!parsedAuthData.flags.userPresent) {
      throw new Error('Authenticator User Present (UP) flag is not set');
    }
    if (
      !parsedAuthData.flags.attestedCredentialData ||
      !parsedAuthData.credentialId ||
      !parsedAuthData.coseKey
    ) {
      throw new Error(
        'Authenticator data missing attested credential data (AT flag)',
      );
    }

    if (input.expectedRpId) {
      const expectedRpHash = createHash('sha256')
        .update(input.expectedRpId)
        .digest();
      if (!parsedAuthData.rpIdHash.equals(expectedRpHash)) {
        throw new Error(
          `RP ID hash mismatch for expected RP ID "${input.expectedRpId}"`,
        );
      }
    }

    const clientDataHash = createHash('sha256')
      .update(clientDataBuffer)
      .digest();
    const credentialPublicKeyObj = coseKeyToNodePublicKey(
      parsedAuthData.coseKey,
    );
    const credentialPublicKeyPem = credentialPublicKeyObj
      .export({ type: 'spki', format: 'pem' })
      .toString();

    const baseResult = {
      aaguid: parsedAuthData.aaguid,
      credentialId: parsedAuthData.credentialId.toString('base64url'),
      credentialPublicKeyPem,
      credentialPublicKeyCoseHex:
        parsedAuthData.credentialPublicKeyCbor?.toString('hex') || '',
      signCount: parsedAuthData.signCount,
      userVerified: parsedAuthData.flags.userVerified,
    };

    switch (fmt) {
      case 'none': {
        const hardwareModel = this.lookupHardwareByAaguid(
          parsedAuthData.aaguid,
          false,
        );
        return {
          ...baseResult,
          valid: true,
          format: 'none',
          trustLevel: 'none',
          isHardwareBacked: false,
          hardwareModel,
        };
      }

      case 'packed':
        return this.validatePackedAttestation(
          authDataRaw,
          clientDataHash,
          parsedAuthData,
          attStmt,
          credentialPublicKeyObj,
          baseResult,
        );

      case 'fido-u2f':
        return this.validateFidoU2fAttestation(
          clientDataHash,
          parsedAuthData,
          attStmt,
          baseResult,
        );

      case 'tpm':
        return this.validateTpmAttestation(
          authDataRaw,
          clientDataHash,
          parsedAuthData,
          attStmt,
          baseResult,
        );

      default:
        throw new Error(`Unsupported WebAuthn attestation format: "${fmt}"`);
    }
  }

  evaluateHardwarePolicy(
    attestation: AttestationValidationResult,
    userRole: string,
    policy: OrganizationHardwarePolicy,
  ): HardwarePolicyEvaluation {
    if (!attestation.valid) {
      return {
        allowed: false,
        reason: attestation.reason || 'Attestation validation failed',
      };
    }

    const normalizedRole = (userRole || 'USER').toUpperCase();
    const adminRoles = (
      policy.adminRoles?.length
        ? policy.adminRoles
        : ['ADMIN', 'SUPER_ADMIN', 'OWNER']
    ).map((r) => r.toUpperCase());

    const isPrivilegedRole = adminRoles.includes(normalizedRole);
    const mustBeHardware =
      policy.requireHardwareAttestation ||
      (policy.enforceForAdminRoles && isPrivilegedRole);

    if (mustBeHardware && !attestation.isHardwareBacked) {
      return {
        allowed: false,
        reason: `Hardware security key attestation required for ${
          isPrivilegedRole
            ? `administrator role (${normalizedRole})`
            : 'this organization'
        }; software or unattested passkeys (${attestation.format}) are rejected`,
      };
    }

    if (policy.requireUserVerification && !attestation.userVerified) {
      return {
        allowed: false,
        reason: 'Authenticator User Verification (UV / PIN / biometric) is required',
      };
    }

    if (policy.allowedAaguids && policy.allowedAaguids.length > 0) {
      const normalizedAllowed = policy.allowedAaguids.map((id) =>
        id.toLowerCase(),
      );
      if (!normalizedAllowed.includes(attestation.aaguid.toLowerCase())) {
        return {
          allowed: false,
          reason: `Authenticator AAGUID ${attestation.aaguid} (${attestation.hardwareModel.modelName}) is not in the organization allowlist`,
        };
      }
    }

    return { allowed: true };
  }

  private validatePackedAttestation(
    authDataRaw: Buffer,
    clientDataHash: Buffer,
    parsedAuthData: ParsedAuthenticatorData,
    attStmt: Record<string, unknown>,
    credentialPublicKeyObj: KeyObject,
    baseResult: Omit<
      AttestationValidationResult,
      | 'valid'
      | 'format'
      | 'trustLevel'
      | 'isHardwareBacked'
      | 'hardwareModel'
    >,
  ): AttestationValidationResult {
    const alg = attStmt.alg;
    const sig = attStmt.sig;
    if (typeof alg !== 'number' || !Buffer.isBuffer(sig)) {
      throw new Error('Invalid packed attStmt: missing numeric alg or binary sig');
    }

    const signedData = Buffer.concat([authDataRaw, clientDataHash]);
    const x5cRaw = attStmt.x5c;

    if (Array.isArray(x5cRaw) && x5cRaw.length > 0) {
      const certBuffers = x5cRaw.map((item) => {
        if (!Buffer.isBuffer(item)) {
          throw new Error('Invalid packed x5c entry: expected DER Buffer');
        }
        return item;
      });

      const chainVerification = this.verifyCertificateChain(certBuffers);
      const leafCert = chainVerification.leafCert;

      const certAaguid = extractCertificateAaguid(leafCert);
      if (certAaguid && certAaguid !== parsedAuthData.aaguid) {
        throw new Error(
          `Certificate AAGUID (${certAaguid}) does not match authenticatorData AAGUID (${parsedAuthData.aaguid})`,
        );
      }

      const sigValid = verifyCoseSignature(
        alg,
        signedData,
        sig,
        leafCert.publicKey,
      );
      if (!sigValid) {
        throw new Error(
          'Packed attestation signature verification failed against leaf certificate',
        );
      }

      const hardwareModel = this.lookupHardwareByAaguid(
        parsedAuthData.aaguid,
        true,
      );

      return {
        ...baseResult,
        valid: true,
        format: 'packed',
        trustLevel: 'fido-hardware-ca',
        isHardwareBacked: true,
        hardwareModel,
        rootCaSubject: chainVerification.rootCert.subject,
        certificateChainSubjects: chainVerification.chain.map((c) => c.subject),
      };
    }

    if (alg !== parsedAuthData.coseKey?.alg) {
      throw new Error(
        `Packed self-attestation algorithm (${alg}) does not match credential key algorithm (${String(parsedAuthData.coseKey?.alg)})`,
      );
    }

    const selfSigValid = verifyCoseSignature(
      alg,
      signedData,
      sig,
      credentialPublicKeyObj,
    );
    if (!selfSigValid) {
      throw new Error('Packed self-attestation signature verification failed');
    }

    const hardwareModel = this.lookupHardwareByAaguid(
      parsedAuthData.aaguid,
      false,
    );

    return {
      ...baseResult,
      valid: true,
      format: 'packed',
      trustLevel: 'self-attested',
      isHardwareBacked: false,
      hardwareModel,
    };
  }

  private validateFidoU2fAttestation(
    clientDataHash: Buffer,
    parsedAuthData: ParsedAuthenticatorData,
    attStmt: Record<string, unknown>,
    baseResult: Omit<
      AttestationValidationResult,
      | 'valid'
      | 'format'
      | 'trustLevel'
      | 'isHardwareBacked'
      | 'hardwareModel'
    >,
  ): AttestationValidationResult {
    const x5cRaw = attStmt.x5c;
    const sig = attStmt.sig;

    if (!Array.isArray(x5cRaw) || x5cRaw.length === 0 || !Buffer.isBuffer(sig)) {
      throw new Error('Invalid fido-u2f attStmt: requires x5c array and sig Buffer');
    }

    const certBuffers = x5cRaw.map((item) => {
      if (!Buffer.isBuffer(item)) {
        throw new Error('Invalid fido-u2f x5c entry: expected DER Buffer');
      }
      return item;
    });

    const chainVerification = this.verifyCertificateChain(certBuffers);
    const leafCert = chainVerification.leafCert;

    const coseKey = parsedAuthData.coseKey!;
    if (
      coseKey.kty !== 2 ||
      coseKey.crv !== 1 ||
      !coseKey.x ||
      !coseKey.y ||
      coseKey.x.length !== 32 ||
      coseKey.y.length !== 32
    ) {
      throw new Error(
        'FIDO-U2F requires an EC2 P-256 credential public key (32-byte X and Y)',
      );
    }

    const publicKeyU2f = Buffer.concat([
      Buffer.from([0x04]),
      coseKey.x,
      coseKey.y,
    ]);

    const verificationData = Buffer.concat([
      Buffer.from([0x00]),
      parsedAuthData.rpIdHash,
      clientDataHash,
      parsedAuthData.credentialId!,
      publicKeyU2f,
    ]);

    const verifier = createVerify('SHA256');
    verifier.update(verificationData);
    verifier.end();

    if (!verifier.verify(leafCert.publicKey, sig)) {
      throw new Error(
        'FIDO-U2F attestation signature verification failed against attestation certificate',
      );
    }

    const hardwareModel = this.lookupHardwareByAaguid(
      parsedAuthData.aaguid,
      true,
    );

    return {
      ...baseResult,
      valid: true,
      format: 'fido-u2f',
      trustLevel: 'fido-hardware-ca',
      isHardwareBacked: true,
      hardwareModel,
      rootCaSubject: chainVerification.rootCert.subject,
      certificateChainSubjects: chainVerification.chain.map((c) => c.subject),
    };
  }

  private validateTpmAttestation(
    authDataRaw: Buffer,
    clientDataHash: Buffer,
    parsedAuthData: ParsedAuthenticatorData,
    attStmt: Record<string, unknown>,
    baseResult: Omit<
      AttestationValidationResult,
      | 'valid'
      | 'format'
      | 'trustLevel'
      | 'isHardwareBacked'
      | 'hardwareModel'
    >,
  ): AttestationValidationResult {
    const ver = attStmt.ver;
    const alg = attStmt.alg;
    const sig = attStmt.sig;
    const certInfo = attStmt.certInfo;
    const pubArea = attStmt.pubArea;
    const x5cRaw = attStmt.x5c;

    if (ver !== '2.0') {
      throw new Error(`Unsupported TPM attestation version: "${String(ver)}"`);
    }
    if (
      typeof alg !== 'number' ||
      !Buffer.isBuffer(sig) ||
      !Buffer.isBuffer(certInfo) ||
      !Buffer.isBuffer(pubArea) ||
      !Array.isArray(x5cRaw) ||
      x5cRaw.length === 0
    ) {
      throw new Error(
        'Invalid TPM attStmt: requires alg, sig, certInfo, pubArea, and x5c',
      );
    }

    const parsedCertInfo = parseTpmsAttest(certInfo);
    if (parsedCertInfo.magic !== TPM_GENERATED_VALUE) {
      throw new Error(
        `Invalid TPM certInfo magic: 0x${parsedCertInfo.magic.toString(16)} (expected 0xff544347)`,
      );
    }
    if (parsedCertInfo.type !== TPM_ST_ATTEST_CERTIFY) {
      throw new Error(
        `Invalid TPM certInfo type: 0x${parsedCertInfo.type.toString(16)} (expected 0x8017)`,
      );
    }

    const expectedAttToBeSigned = createHash('sha256')
      .update(Buffer.concat([authDataRaw, clientDataHash]))
      .digest();
    if (!parsedCertInfo.extraData.equals(expectedAttToBeSigned)) {
      throw new Error(
        'TPM certInfo extraData does not match SHA-256(authData || clientDataHash)',
      );
    }

    const parsedPubArea = parseTpmtPublic(pubArea);
    const nameHashAlg = tpmAlgToNodeHash(parsedPubArea.nameAlg);
    const pubAreaDigest = createHash(nameHashAlg).update(pubArea).digest();
    const expectedName = Buffer.concat([
      Buffer.from([
        (parsedPubArea.nameAlg >> 8) & 0xff,
        parsedPubArea.nameAlg & 0xff,
      ]),
      pubAreaDigest,
    ]);
    if (!parsedCertInfo.attestedName.equals(expectedName)) {
      throw new Error('TPM certInfo attested.name does not match pubArea digest');
    }

    const coseKey = parsedAuthData.coseKey!;
    if (parsedPubArea.type === TPM_ALG_ECC) {
      if (
        !coseKey.x ||
        !coseKey.y ||
        !parsedPubArea.uniqueX?.equals(coseKey.x) ||
        !parsedPubArea.uniqueY?.equals(coseKey.y)
      ) {
        throw new Error('TPM ECC public key coordinates do not match COSE key');
      }
    } else if (parsedPubArea.type === TPM_ALG_RSA) {
      if (!coseKey.n || !parsedPubArea.uniqueRsaN?.equals(coseKey.n)) {
        throw new Error('TPM RSA modulus does not match COSE key');
      }
    }

    const certBuffers = x5cRaw.map((item) => {
      if (!Buffer.isBuffer(item)) {
        throw new Error('Invalid TPM x5c entry: expected DER Buffer');
      }
      return item;
    });
    const chainVerification = this.verifyCertificateChain(certBuffers);
    const aikCert = chainVerification.leafCert;

    const certAaguid = extractCertificateAaguid(aikCert);
    if (certAaguid && certAaguid !== parsedAuthData.aaguid) {
      throw new Error(
        `TPM AIK certificate AAGUID (${certAaguid}) does not match authData AAGUID (${parsedAuthData.aaguid})`,
      );
    }

    const sigValid = verifyCoseSignature(alg, certInfo, sig, aikCert.publicKey);
    if (!sigValid) {
      throw new Error('TPM attestation signature verification failed');
    }

    const hardwareModel = this.lookupHardwareByAaguid(
      parsedAuthData.aaguid,
      true,
    );

    return {
      ...baseResult,
      valid: true,
      format: 'tpm',
      trustLevel: 'fido-hardware-ca',
      isHardwareBacked: true,
      hardwareModel,
      rootCaSubject: chainVerification.rootCert.subject,
      certificateChainSubjects: chainVerification.chain.map((c) => c.subject),
    };
  }

  verifyCertificateChain(
    x5cDerBuffers: Buffer[],
    now = new Date(),
  ): {
    leafCert: X509Certificate;
    rootCert: X509Certificate;
    chain: X509Certificate[];
  } {
    if (this.trustedRootCAs.size === 0) {
      throw new Error(
        'No trusted FIDO Root CA certificates loaded in trust store',
      );
    }

    const chain = x5cDerBuffers.map((buf) => new X509Certificate(buf));
    const leafCert = chain[0];

    for (let i = 0; i < chain.length; i++) {
      const cert = chain[i];
      const validFrom = new Date(cert.validFrom);
      const validTo = new Date(cert.validTo);

      if (now < validFrom || now > validTo) {
        throw new Error(
          `Attestation certificate "${cert.subject}" is expired or not yet valid (${cert.validFrom} - ${cert.validTo})`,
        );
      }

      if (i + 1 < chain.length) {
        const issuer = chain[i + 1];
        if (cert.issuer !== issuer.subject) {
          throw new Error(
            `Certificate chain broken: "${cert.subject}" issuer "${cert.issuer}" does not match "${issuer.subject}"`,
          );
        }
        if (!cert.verify(issuer.publicKey)) {
          throw new Error(
            `Cryptographic signature check failed between "${cert.subject}" and intermediate "${issuer.subject}"`,
          );
        }
      }
    }

    const topCert = chain[chain.length - 1];

    const directRoot = this.trustedRootCAs.get(topCert.fingerprint256);
    if (directRoot && topCert.verify(directRoot.publicKey)) {
      return { leafCert, rootCert: directRoot, chain };
    }

    for (const rootCa of this.trustedRootCAs.values()) {
      const rootFrom = new Date(rootCa.validFrom);
      const rootTo = new Date(rootCa.validTo);
      if (now < rootFrom || now > rootTo) {
        continue;
      }

      if (topCert.issuer === rootCa.subject && topCert.verify(rootCa.publicKey)) {
        return {
          leafCert,
          rootCert: rootCa,
          chain: [...chain, rootCa],
        };
      }
    }

    throw new Error(
      `Untrusted attestation certificate chain: issuer "${topCert.issuer}" does not chain to any trusted FIDO Root CA`,
    );
  }

  parseAuthenticatorData(authData: Buffer): ParsedAuthenticatorData {
    if (authData.length < 37) {
      throw new Error(
        `authenticatorData too short (${authData.length} bytes; minimum 37 bytes)`,
      );
    }

    const rpIdHash = authData.subarray(0, 32);
    const flagsRaw = authData.readUInt8(32);
    const signCount = authData.readUInt32BE(33);

    const flags = {
      raw: flagsRaw,
      userPresent: (flagsRaw & 0x01) !== 0,
      userVerified: (flagsRaw & 0x04) !== 0,
      attestedCredentialData: (flagsRaw & 0x40) !== 0,
      extensionDataIncluded: (flagsRaw & 0x80) !== 0,
    };

    if (!flags.attestedCredentialData) {
      return {
        rpIdHash,
        flags,
        signCount,
        aaguid: ZERO_AAGUID,
        aaguidBytes: Buffer.alloc(16, 0),
      };
    }

    if (authData.length < 55) {
      throw new Error(
        'authenticatorData with AT flag set is missing AAGUID and credentialIdLength',
      );
    }

    const aaguidBytes = authData.subarray(37, 53);
    const aaguid = formatAaguidUuid(aaguidBytes);
    const credIdLen = authData.readUInt16BE(53);

    if (authData.length < 55 + credIdLen) {
      throw new Error('authenticatorData truncated inside credentialId');
    }

    const credentialId = authData.subarray(55, 55 + credIdLen);
    const remainingCbor = authData.subarray(55 + credIdLen);

    const { value: rawCoseMap, bytesRead } =
      decodeCborWithLength(remainingCbor);
    const credentialPublicKeyCbor = remainingCbor.subarray(0, bytesRead);
    const coseKey = parseCoseKeyMap(rawCoseMap as Record<number, unknown>);

    return {
      rpIdHash,
      flags,
      signCount,
      aaguid,
      aaguidBytes,
      credentialId,
      credentialPublicKeyCbor,
      coseKey,
    };
  }
}

export function formatAaguidUuid(bytes: Buffer): string {
  if (bytes.length !== 16) {
    throw new Error(`AAGUID must be 16 bytes, got ${bytes.length}`);
  }
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function derToPem(der: Buffer): string {
  const b64 = der.toString('base64');
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

export function extractCertificateAaguid(cert: X509Certificate): string | null {
  const raw = cert.raw;
  const oidIdx = raw.indexOf(FIDO_AAGUID_OID_DER);
  if (oidIdx === -1) {
    return null;
  }

  let cursor = oidIdx + FIDO_AAGUID_OID_DER.length;
  if (cursor + 3 <= raw.length && raw[cursor] === 0x01) {
    cursor += 3;
  }

  if (
    cursor + 20 <= raw.length &&
    raw[cursor] === 0x04 &&
    raw[cursor + 1] === 0x12 &&
    raw[cursor + 2] === 0x04 &&
    raw[cursor + 3] === 0x10
  ) {
    return formatAaguidUuid(raw.subarray(cursor + 4, cursor + 20));
  }

  if (
    cursor + 18 <= raw.length &&
    raw[cursor] === 0x04 &&
    raw[cursor + 1] === 0x10
  ) {
    return formatAaguidUuid(raw.subarray(cursor + 2, cursor + 18));
  }

  return null;
}

function toBuffer(input: Buffer | string): Buffer {
  if (Buffer.isBuffer(input)) return input;
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

function parseCoseKeyMap(map: Record<number, unknown>): CosePublicKey {
  const kty = Number(map[1]);
  const alg = Number(map[3]);

  if (kty === 2) {
    const crv = Number(map[-1]);
    const x = map[-2];
    const y = map[-3];
    if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y)) {
      throw new Error('COSE EC2 key missing x or y coordinate');
    }
    return { kty, alg, crv, x, y };
  }

  if (kty === 3) {
    const n = map[-1];
    const e = map[-2];
    if (!Buffer.isBuffer(n) || !Buffer.isBuffer(e)) {
      throw new Error('COSE RSA key missing n or e parameter');
    }
    return { kty, alg, n, e };
  }

  if (kty === 1) {
    const crv = Number(map[-1]);
    const x = map[-2];
    if (!Buffer.isBuffer(x)) {
      throw new Error('COSE OKP key missing x coordinate');
    }
    return { kty, alg, crv, x };
  }

  throw new Error(`Unsupported COSE key type (kty=${kty})`);
}

export function coseKeyToNodePublicKey(cose: CosePublicKey): KeyObject {
  if (cose.kty === 2 && cose.x && cose.y) {
    const crvMap: Record<number, string> = {
      1: 'P-256',
      2: 'P-384',
      3: 'P-521',
    };
    const crvName = crvMap[cose.crv ?? 1];
    if (!crvName) {
      throw new Error(`Unsupported COSE EC2 curve: ${String(cose.crv)}`);
    }
    return createPublicKey({
      key: {
        kty: 'EC',
        crv: crvName,
        x: cose.x.toString('base64url'),
        y: cose.y.toString('base64url'),
      },
      format: 'jwk',
    });
  }

  if (cose.kty === 3 && cose.n && cose.e) {
    return createPublicKey({
      key: {
        kty: 'RSA',
        n: cose.n.toString('base64url'),
        e: cose.e.toString('base64url'),
      },
      format: 'jwk',
    });
  }

  if (cose.kty === 1 && cose.x) {
    return createPublicKey({
      key: {
        kty: 'OKP',
        crv: 'Ed25519',
        x: cose.x.toString('base64url'),
      },
      format: 'jwk',
    });
  }

  throw new Error('Cannot convert COSE key to Node KeyObject');
}

function verifyCoseSignature(
  alg: number,
  data: Buffer,
  signature: Buffer,
  publicKey: KeyObject,
): boolean {
  if (alg === -8) {
    const verifier = createVerify('SHA512');
    verifier.update(data);
    verifier.end();
    return verifier.verify(publicKey, signature);
  }

  if (alg === -37 || alg === -38 || alg === -39) {
    const hashAlg =
      alg === -37 ? 'SHA256' : alg === -38 ? 'SHA384' : 'SHA512';
    const verifier = createVerify(hashAlg);
    verifier.update(data);
    verifier.end();
    return verifier.verify(
      {
        key: publicKey,
        padding: 6,
        saltLength: -1,
      },
      signature,
    );
  }

  const algMap: Record<number, string> = {
    [-7]: 'SHA256',
    [-35]: 'SHA384',
    [-36]: 'SHA512',
    [-257]: 'SHA256',
    [-258]: 'SHA384',
    [-259]: 'SHA512',
    [-65535]: 'SHA1',
  };

  const hashName = algMap[alg];
  if (!hashName) {
    throw new Error(`Unsupported COSE signature algorithm: ${alg}`);
  }

  const verifier = createVerify(hashName);
  verifier.update(data);
  verifier.end();
  return verifier.verify(publicKey, signature);
}

function parseTpmsAttest(buf: Buffer): {
  magic: number;
  type: number;
  extraData: Buffer;
  attestedName: Buffer;
} {
  let offset = 0;
  if (buf.length < 12) {
    throw new Error('TPM certInfo buffer too short');
  }

  const magic = buf.readUInt32BE(offset);
  offset += 4;
  const type = buf.readUInt16BE(offset);
  offset += 2;

  const qSignerLen = buf.readUInt16BE(offset);
  offset += 2 + qSignerLen;

  const extraDataLen = buf.readUInt16BE(offset);
  offset += 2;
  const extraData = buf.subarray(offset, offset + extraDataLen);
  offset += extraDataLen;

  offset += 17;
  offset += 8;

  const attestedNameLen = buf.readUInt16BE(offset);
  offset += 2;
  const attestedName = buf.subarray(offset, offset + attestedNameLen);

  return { magic, type, extraData, attestedName };
}

function parseTpmtPublic(buf: Buffer): {
  type: number;
  nameAlg: number;
  uniqueX?: Buffer;
  uniqueY?: Buffer;
  uniqueRsaN?: Buffer;
} {
  let offset = 0;
  if (buf.length < 10) {
    throw new Error('TPM pubArea buffer too short');
  }

  const type = buf.readUInt16BE(offset);
  offset += 2;
  const nameAlg = buf.readUInt16BE(offset);
  offset += 2;
  offset += 4;
  const authPolicyLen = buf.readUInt16BE(offset);
  offset += 2 + authPolicyLen;

  if (type === TPM_ALG_ECC) {
    const symmetric = buf.readUInt16BE(offset);
    offset += 2;
    if (symmetric !== 0x0010) {
      offset += 4;
    }
    const scheme = buf.readUInt16BE(offset);
    offset += 2;
    if (scheme !== 0x0010) {
      offset += 2;
    }
    const curveId = buf.readUInt16BE(offset);
    offset += 2;
    if (curveId !== TPM_ECC_NIST_P256 && curveId !== TPM_ECC_NIST_P384) {
      throw new Error(`Unsupported TPM ECC curve ID: 0x${curveId.toString(16)}`);
    }
    offset += 2;

    const xLen = buf.readUInt16BE(offset);
    offset += 2;
    const uniqueX = buf.subarray(offset, offset + xLen);
    offset += xLen;

    const yLen = buf.readUInt16BE(offset);
    offset += 2;
    const uniqueY = buf.subarray(offset, offset + yLen);

    return { type, nameAlg, uniqueX, uniqueY };
  }

  if (type === TPM_ALG_RSA) {
    const symmetric = buf.readUInt16BE(offset);
    offset += 2;
    if (symmetric !== 0x0010) {
      offset += 4;
    }
    const scheme = buf.readUInt16BE(offset);
    offset += 2;
    if (scheme !== 0x0010) {
      offset += 2;
    }
    offset += 6;

    const nLen = buf.readUInt16BE(offset);
    offset += 2;
    const uniqueRsaN = buf.subarray(offset, offset + nLen);
    return { type, nameAlg, uniqueRsaN };
  }

  throw new Error(`Unsupported TPM pubArea algorithm type: 0x${type.toString(16)}`);
}

function tpmAlgToNodeHash(alg: number): string {
  switch (alg) {
    case TPM_ALG_SHA1:
      return 'sha1';
    case TPM_ALG_SHA256:
      return 'sha256';
    case TPM_ALG_SHA384:
      return 'sha384';
    case TPM_ALG_SHA512:
      return 'sha512';
    default:
      throw new Error(`Unsupported TPM nameAlg: 0x${alg.toString(16)}`);
  }
}

export function decodeCbor(buf: Buffer): unknown {
  return decodeCborWithLength(buf).value;
}

export function decodeCborWithLength(buf: Buffer): {
  value: unknown;
  bytesRead: number;
} {
  let offset = 0;

  function readUint(addl: number): number {
    if (addl < 24) return addl;
    if (addl === 24) {
      const v = buf.readUInt8(offset);
      offset += 1;
      return v;
    }
    if (addl === 25) {
      const v = buf.readUInt16BE(offset);
      offset += 2;
      return v;
    }
    if (addl === 26) {
      const v = buf.readUInt32BE(offset);
      offset += 4;
      return v;
    }
    if (addl === 27) {
      const hi = buf.readUInt32BE(offset);
      const lo = buf.readUInt32BE(offset + 4);
      offset += 8;
      return hi * 0x100000000 + lo;
    }
    throw new Error(`Unsupported CBOR additional info: ${addl}`);
  }

  function decodeItem(): unknown {
    if (offset >= buf.length) {
      throw new Error('Unexpected end of CBOR input');
    }
    const initial = buf.readUInt8(offset);
    offset += 1;
    const major = initial >> 5;
    const addl = initial & 0x1f;

    switch (major) {
      case 0:
        return readUint(addl);
      case 1:
        return -1 - readUint(addl);
      case 2: {
        const len = readUint(addl);
        const out = Buffer.from(buf.subarray(offset, offset + len));
        offset += len;
        return out;
      }
      case 3: {
        const len = readUint(addl);
        const out = buf.subarray(offset, offset + len).toString('utf8');
        offset += len;
        return out;
      }
      case 4: {
        const len = readUint(addl);
        const arr: unknown[] = [];
        for (let i = 0; i < len; i++) {
          arr.push(decodeItem());
        }
        return arr;
      }
      case 5: {
        const len = readUint(addl);
        const map: Record<string | number, unknown> = {};
        for (let i = 0; i < len; i++) {
          const key = decodeItem() as string | number;
          const val = decodeItem();
          map[key] = val;
        }
        return map;
      }
      case 7: {
        if (addl === 20) return false;
        if (addl === 21) return true;
        if (addl === 22) return null;
        if (addl === 23) return undefined;
        throw new Error(`Unsupported CBOR simple value: ${addl}`);
      }
      default:
        throw new Error(`Unsupported CBOR major type: ${major}`);
    }
  }

  const value = decodeItem();
  return { value, bytesRead: offset };
}
