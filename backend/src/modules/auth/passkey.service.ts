import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createPublicKey,
  createVerify,
  randomBytes,
} from 'crypto';
import Redis from 'ioredis';
import {
  AttestationValidationResult,
  AttestationValidatorService,
  OrganizationHardwarePolicy,
  SupportedAttestationFormat,
} from './attestation-validator.service';

export interface PasskeyCredentialRecord {
  id: string;
  userId: string;
  credentialId: string;
  publicKeyPem: string;
  publicKeyCoseHex: string;
  signCount: number;
  aaguid: string;
  hardwareModelName: string;
  hardwareVendor: string;
  isHardwareBacked: boolean;
  attestationFormat: SupportedAttestationFormat;
  trustLevel: string;
  deviceLabel: string;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PendingWebAuthnChallenge {
  challenge: string;
  userId: string;
  username: string;
  userRole: string;
  organizationId?: string;
  type: 'registration' | 'authentication';
  createdAt: number;
  expiresAt: number;
}

export interface RegistrationOptionsResponse {
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
  timeout: number;
  attestation: 'direct' | 'enterprise';
  authenticatorSelection: {
    authenticatorAttachment?: 'cross-platform';
    requireResidentKey: boolean;
    residentKey: 'preferred' | 'required';
    userVerification: 'preferred' | 'required';
  };
  excludeCredentials: Array<{ id: string; type: 'public-key' }>;
  hardwareOnlyEnforced: boolean;
}

export interface RegisterPasskeyInput {
  userId: string;
  username: string;
  userRole?: string;
  organizationId?: string;
  deviceLabel?: string;
  transports?: string[];
  attestationObject: Buffer | string;
  clientDataJSON: Buffer | string;
  expectedOrigin?: string;
  expectedRpId?: string;
}

export interface VerifyAssertionInput {
  userId: string;
  credentialId: string;
  authenticatorData: Buffer | string;
  clientDataJSON: Buffer | string;
  signature: Buffer | string;
  expectedOrigin?: string;
  expectedRpId?: string;
}

export interface PasskeyRedisLike {
  status?: string;
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    ttlSeconds: number,
  ): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  disconnect(): void;
}

@Injectable()
export class PasskeyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PasskeyService.name);
  private readonly rpId: string;
  private readonly rpName: string;
  private readonly expectedOrigin: string;
  private readonly challengeTtlSeconds = 300;
  private readonly disableRedis: boolean;

  private redisClient: PasskeyRedisLike | null = null;
  private readonly inMemoryChallenges = new Map<
    string,
    PendingWebAuthnChallenge
  >();
  private readonly credentialsById = new Map<string, PasskeyCredentialRecord>();
  private readonly credentialIdsByUser = new Map<string, Set<string>>();
  private readonly orgPolicies = new Map<string, OrganizationHardwarePolicy>();

  private defaultPolicy: OrganizationHardwarePolicy = {
    requireHardwareAttestation: false,
    enforceForAdminRoles: true,
    adminRoles: ['ADMIN', 'SUPER_ADMIN', 'OWNER'],
    requireUserVerification: false,
  };

  constructor(
    private readonly attestationValidator: AttestationValidatorService,
    @Optional() private readonly configService?: ConfigService,
    @Optional()
    options?: {
      rpId?: string;
      rpName?: string;
      expectedOrigin?: string;
      disableRedis?: boolean;
    },
  ) {
    this.rpId =
      options?.rpId ||
      this.configService?.get<string>('WEBAUTHN_RP_ID') ||
      process.env.WEBAUTHN_RP_ID ||
      'codepulse.dev';

    this.rpName =
      options?.rpName ||
      this.configService?.get<string>('WEBAUTHN_RP_NAME') ||
      process.env.WEBAUTHN_RP_NAME ||
      'CodePulse Enterprise Security';

    this.expectedOrigin =
      options?.expectedOrigin ||
      this.configService?.get<string>('WEBAUTHN_ORIGIN') ||
      process.env.WEBAUTHN_ORIGIN ||
      'https://codepulse.dev';

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
        .then(() => {
          this.redisClient = client as unknown as PasskeyRedisLike;
        })
        .catch(() => {
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

  setRedisClient(client: PasskeyRedisLike | null): void {
    this.redisClient = client;
  }

  setOrganizationPolicy(
    organizationId: string,
    policy: Partial<OrganizationHardwarePolicy>,
  ): OrganizationHardwarePolicy {
    const existing = this.getEffectivePolicy(organizationId);
    const updated: OrganizationHardwarePolicy = {
      ...existing,
      ...policy,
      organizationId,
    };
    this.orgPolicies.set(organizationId, updated);
    return updated;
  }

  setDefaultPolicy(
    policy: Partial<OrganizationHardwarePolicy>,
  ): OrganizationHardwarePolicy {
    this.defaultPolicy = {
      ...this.defaultPolicy,
      ...policy,
    };
    return this.defaultPolicy;
  }

  getEffectivePolicy(organizationId?: string): OrganizationHardwarePolicy {
    if (organizationId && this.orgPolicies.has(organizationId)) {
      return this.orgPolicies.get(organizationId)!;
    }
    return { ...this.defaultPolicy, organizationId };
  }

  isHardwareRequiredForUser(
    userRole = 'USER',
    organizationId?: string,
  ): boolean {
    const policy = this.getEffectivePolicy(organizationId);
    if (policy.requireHardwareAttestation) {
      return true;
    }
    if (policy.enforceForAdminRoles) {
      const normalizedRole = (userRole || 'USER').toUpperCase();
      return policy.adminRoles
        .map((r) => r.toUpperCase())
        .includes(normalizedRole);
    }
    return false;
  }

  async generateRegistrationOptions(params: {
    userId: string;
    username: string;
    displayName?: string;
    userRole?: string;
    organizationId?: string;
  }): Promise<RegistrationOptionsResponse> {
    const challenge = randomBytes(32).toString('base64url');
    const now = Date.now();
    const record: PendingWebAuthnChallenge = {
      challenge,
      userId: params.userId,
      username: params.username,
      userRole: params.userRole || 'USER',
      organizationId: params.organizationId,
      type: 'registration',
      createdAt: now,
      expiresAt: now + this.challengeTtlSeconds * 1000,
    };

    await this.storePendingChallenge(params.userId, 'registration', record);

    const hardwareOnly = this.isHardwareRequiredForUser(
      params.userRole,
      params.organizationId,
    );
    const existing = this.getUserCredentials(params.userId);

    return {
      challenge,
      rp: {
        name: this.rpName,
        id: this.rpId,
      },
      user: {
        id: Buffer.from(params.userId, 'utf8').toString('base64url'),
        name: params.username,
        displayName: params.displayName || params.username,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
        { type: 'public-key', alg: -8 },
      ],
      timeout: 60_000,
      attestation: 'direct',
      authenticatorSelection: {
        ...(hardwareOnly ? { authenticatorAttachment: 'cross-platform' } : {}),
        requireResidentKey: false,
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: existing.map((cred) => ({
        id: cred.credentialId,
        type: 'public-key' as const,
      })),
      hardwareOnlyEnforced: hardwareOnly,
    };
  }

  async verifyAndRegisterPasskey(input: RegisterPasskeyInput): Promise<{
    credential: PasskeyCredentialRecord;
    attestation: AttestationValidationResult;
  }> {
    const pending = await this.consumePendingChallenge(
      input.userId,
      'registration',
    );
    if (!pending) {
      throw new BadRequestException(
        'No active or unexpired WebAuthn registration challenge found for user',
      );
    }

    const userRole = input.userRole || pending.userRole || 'USER';
    const organizationId = input.organizationId || pending.organizationId;

    let attestation: AttestationValidationResult;
    try {
      attestation = await this.attestationValidator.validateAttestation({
        attestationObject: input.attestationObject,
        clientDataJSON: input.clientDataJSON,
        expectedChallenge: pending.challenge,
        expectedOrigin: input.expectedOrigin ?? this.expectedOrigin,
        expectedRpId: input.expectedRpId ?? this.rpId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(
        `WebAuthn attestation validation failed: ${msg}`,
      );
    }

    const effectivePolicy = this.getEffectivePolicy(organizationId);
    const policyEval = this.attestationValidator.evaluateHardwarePolicy(
      attestation,
      userRole,
      effectivePolicy,
    );

    if (!policyEval.allowed) {
      this.logger.warn(
        `Rejected WebAuthn registration for user ${input.userId} (role=${userRole}): ${policyEval.reason}`,
      );
      throw new ForbiddenException(policyEval.reason);
    }

    if (this.credentialsById.has(attestation.credentialId)) {
      throw new BadRequestException(
        'This security key credential is already registered',
      );
    }

    const nowIso = new Date().toISOString();
    const record: PasskeyCredentialRecord = {
      id: randomBytes(12).toString('hex'),
      userId: input.userId,
      credentialId: attestation.credentialId,
      publicKeyPem: attestation.credentialPublicKeyPem,
      publicKeyCoseHex: attestation.credentialPublicKeyCoseHex,
      signCount: attestation.signCount,
      aaguid: attestation.aaguid,
      hardwareModelName: attestation.hardwareModel.modelName,
      hardwareVendor: attestation.hardwareModel.vendor,
      isHardwareBacked: attestation.isHardwareBacked,
      attestationFormat: attestation.format,
      trustLevel: attestation.trustLevel,
      deviceLabel:
        input.deviceLabel || attestation.hardwareModel.modelName || 'Security Key',
      transports:
        input.transports || attestation.hardwareModel.transports || ['usb'],
      createdAt: nowIso,
      lastUsedAt: null,
    };

    this.credentialsById.set(record.credentialId, record);
    if (!this.credentialIdsByUser.has(input.userId)) {
      this.credentialIdsByUser.set(input.userId, new Set());
    }
    this.credentialIdsByUser.get(input.userId)!.add(record.credentialId);

    this.logger.log(
      `Registered ${record.isHardwareBacked ? 'hardware token' : 'passkey'} "${record.hardwareModelName}" (AAGUID=${record.aaguid}, fmt=${record.attestationFormat}) for user ${input.userId}`,
    );

    return { credential: record, attestation };
  }

  async generateAuthenticationOptions(userId: string): Promise<{
    challenge: string;
    rpId: string;
    timeout: number;
    allowCredentials: Array<{
      id: string;
      type: 'public-key';
      transports?: string[];
    }>;
  }> {
    const credentials = this.getUserCredentials(userId);
    if (credentials.length === 0) {
      throw new NotFoundException(
        'No registered passkeys or hardware security keys found for user',
      );
    }

    const challenge = randomBytes(32).toString('base64url');
    const now = Date.now();
    await this.storePendingChallenge(userId, 'authentication', {
      challenge,
      userId,
      username: userId,
      userRole: 'USER',
      type: 'authentication',
      createdAt: now,
      expiresAt: now + this.challengeTtlSeconds * 1000,
    });

    return {
      challenge,
      rpId: this.rpId,
      timeout: 60_000,
      allowCredentials: credentials.map((c) => ({
        id: c.credentialId,
        type: 'public-key' as const,
        transports: c.transports,
      })),
    };
  }

  async verifyAuthenticationAssertion(input: VerifyAssertionInput): Promise<{
    verified: boolean;
    credential: PasskeyCredentialRecord;
    newSignCount: number;
  }> {
    const pending = await this.consumePendingChallenge(
      input.userId,
      'authentication',
    );
    if (!pending) {
      throw new UnauthorizedException(
        'No active WebAuthn authentication challenge found',
      );
    }

    const credential = this.credentialsById.get(input.credentialId);
    if (!credential || credential.userId !== input.userId) {
      throw new UnauthorizedException('Unrecognized WebAuthn credential ID');
    }

    const clientDataBuf = toBuf(input.clientDataJSON);
    const authDataBuf = toBuf(input.authenticatorData);
    const sigBuf = toBuf(input.signature);

    const clientData = JSON.parse(clientDataBuf.toString('utf8')) as {
      type?: string;
      challenge?: string;
      origin?: string;
    };

    if (clientData.type !== 'webauthn.get') {
      throw new UnauthorizedException('Invalid assertion clientDataJSON.type');
    }
    if (clientData.challenge !== pending.challenge) {
      throw new UnauthorizedException('Assertion challenge mismatch');
    }
    const expectedOrigin = input.expectedOrigin ?? this.expectedOrigin;
    if (clientData.origin !== expectedOrigin) {
      throw new UnauthorizedException('Assertion origin mismatch');
    }

    const parsedAuthData =
      this.attestationValidator.parseAuthenticatorData(authDataBuf);
    const expectedRpHash = createHash('sha256')
      .update(input.expectedRpId ?? this.rpId)
      .digest();
    if (!parsedAuthData.rpIdHash.equals(expectedRpHash)) {
      throw new UnauthorizedException('Assertion RP ID hash mismatch');
    }
    if (!parsedAuthData.flags.userPresent) {
      throw new UnauthorizedException('Assertion User Present flag not set');
    }

    const clientDataHash = createHash('sha256').update(clientDataBuf).digest();
    const signedBytes = Buffer.concat([authDataBuf, clientDataHash]);
    const pubKey = createPublicKey(credential.publicKeyPem);

    const verifier = createVerify('SHA256');
    verifier.update(signedBytes);
    verifier.end();
    if (!verifier.verify(pubKey, sigBuf)) {
      throw new UnauthorizedException(
        'Invalid WebAuthn assertion cryptographic signature',
      );
    }

    if (
      (parsedAuthData.signCount > 0 || credential.signCount > 0) &&
      parsedAuthData.signCount <= credential.signCount
    ) {
      throw new UnauthorizedException(
        `Authenticator signCount rollback detected (${parsedAuthData.signCount} <= ${credential.signCount}); possible cloned token`,
      );
    }

    credential.signCount = parsedAuthData.signCount;
    credential.lastUsedAt = new Date().toISOString();

    return {
      verified: true,
      credential,
      newSignCount: parsedAuthData.signCount,
    };
  }

  getUserCredentials(userId: string): PasskeyCredentialRecord[] {
    const ids = this.credentialIdsByUser.get(userId);
    if (!ids) return [];
    const results: PasskeyCredentialRecord[] = [];
    for (const id of ids) {
      const cred = this.credentialsById.get(id);
      if (cred) results.push(cred);
    }
    return results;
  }

  revokeUserCredential(userId: string, credentialId: string): boolean {
    const cred = this.credentialsById.get(credentialId);
    if (!cred || cred.userId !== userId) {
      return false;
    }
    this.credentialsById.delete(credentialId);
    this.credentialIdsByUser.get(userId)?.delete(credentialId);
    return true;
  }

  private async storePendingChallenge(
    userId: string,
    type: 'registration' | 'authentication',
    record: PendingWebAuthnChallenge,
  ): Promise<void> {
    const key = `webauthn:challenge:${type}:${userId}`;
    if (this.redisClient) {
      try {
        await this.redisClient.set(
          key,
          JSON.stringify(record),
          'EX',
          this.challengeTtlSeconds,
        );
        return;
      } catch {
        // Fall through to in-memory map
      }
    }
    this.inMemoryChallenges.set(key, record);
  }

  private async consumePendingChallenge(
    userId: string,
    type: 'registration' | 'authentication',
  ): Promise<PendingWebAuthnChallenge | null> {
    const key = `webauthn:challenge:${type}:${userId}`;
    const now = Date.now();

    if (this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        if (raw) {
          await this.redisClient.del(key);
          const parsed = JSON.parse(raw) as PendingWebAuthnChallenge;
          return parsed.expiresAt >= now ? parsed : null;
        }
      } catch {
        // Fall through to in-memory map
      }
    }

    const local = this.inMemoryChallenges.get(key);
    this.inMemoryChallenges.delete(key);
    if (!local || local.expiresAt < now) {
      return null;
    }
    return local;
  }
}

function toBuf(val: Buffer | string): Buffer {
  if (Buffer.isBuffer(val)) return val;
  const normalized = val.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}
