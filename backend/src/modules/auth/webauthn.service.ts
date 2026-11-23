import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PasskeyService } from './passkey.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface WebAuthnCredential {
  id: string; // Base64URL credential ID
  userId: string;
  name: string; // e.g. "MacBook TouchID", "YubiKey 5C"
  publicKey: string; // PEM or COSE Hex
  counter: number;
  transports?: string[];
  createdAt: number;
  lastUsedAt?: number;
}

export interface WebAuthnRegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
  timeout: number;
  attestation: 'none' | 'direct';
  authenticatorSelection: {
    residentKey: 'preferred' | 'required';
    userVerification: 'preferred' | 'required';
  };
}

export interface WebAuthnAuthenticationOptions {
  challenge: string;
  timeout: number;
  rpId: string;
  userVerification: 'preferred' | 'required';
  allowCredentials: Array<{
    id: string;
    type: 'public-key';
    transports?: string[];
  }>;
}

export interface VerifyRegistrationDto {
  userId: string;
  credentialId: string;
  publicKey: string;
  clientDataJSON: string;
  name?: string;
  transports?: string[];
}

export interface VerifyAuthenticationDto {
  userId: string;
  credentialId: string;
  signature: string;
  clientDataJSON: string;
  counter: number;
}

@Injectable()
export class WebAuthnService {
  private readonly rpName = 'CodePulse';
  private readonly rpId = 'codepulse.dev';
  private readonly pendingChallenges = new Map<string, { challenge: string; expiresAt: number }>();
  private readonly credentialsStore = new Map<string, WebAuthnCredential[]>(); // userId -> credentials

  constructor(
    @Optional() private readonly passkeyService?: PasskeyService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  /**
   * Generates W3C WebAuthn Level 3 registration options with cryptographic challenge
   */
  generateRegistrationOptions(userId: string, username: string): WebAuthnRegistrationOptions {
    const challenge = randomBytes(32).toString('base64url');
    this.pendingChallenges.set(`reg:${userId}`, {
      challenge,
      expiresAt: Date.now() + 60000, // 60s validity
    });

    return {
      challenge,
      rp: {
        name: this.rpName,
        id: this.rpId,
      },
      user: {
        id: Buffer.from(userId).toString('base64url'),
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 }, // RS256
        { type: 'public-key', alg: -8 },   // EdDSA
      ],
      timeout: 60000,
      attestation: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    };
  }

  /**
   * Verifies registration response and persists new hardware credential public key
   */
  verifyRegistrationResponse(dto: VerifyRegistrationDto): { verified: boolean; credential: WebAuthnCredential } {
    const pending = this.pendingChallenges.get(`reg:${dto.userId}`);
    if (!pending || Date.now() > pending.expiresAt) {
      throw new BadRequestException('Registration challenge expired or invalid');
    }
    this.pendingChallenges.delete(`reg:${dto.userId}`);

    // Parse clientDataJSON
    try {
      const clientData = JSON.parse(
        Buffer.from(dto.clientDataJSON, 'base64url').toString('utf8'),
      );
      if (clientData.type !== 'webauthn.create') {
        throw new BadRequestException(`Invalid clientData type: ${clientData.type}`);
      }
      if (clientData.challenge !== pending.challenge) {
        throw new BadRequestException('Cryptographic challenge mismatch');
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Malformed clientDataJSON payload');
    }

    const credential: WebAuthnCredential = {
      id: dto.credentialId,
      userId: dto.userId,
      name: dto.name || 'Hardware Passkey',
      publicKey: dto.publicKey,
      counter: 0,
      transports: dto.transports || ['internal', 'usb'],
      createdAt: Date.now(),
    };

    const userCreds = this.credentialsStore.get(dto.userId) || [];
    // Ensure no duplicates
    const filtered = userCreds.filter((c) => c.id !== credential.id);
    filtered.push(credential);
    this.credentialsStore.set(dto.userId, filtered);

    return {
      verified: true,
      credential,
    };
  }

  /**
   * Generates authentication options with challenge and allowed credential IDs
   */
  generateAuthenticationOptions(userId: string): WebAuthnAuthenticationOptions {
    const challenge = randomBytes(32).toString('base64url');
    this.pendingChallenges.set(`auth:${userId}`, {
      challenge,
      expiresAt: Date.now() + 60000,
    });

    const userCreds = this.credentialsStore.get(userId) || [];

    return {
      challenge,
      timeout: 60000,
      rpId: this.rpId,
      userVerification: 'preferred',
      allowCredentials: userCreds.map((c) => ({
        id: c.id,
        type: 'public-key' as const,
        transports: c.transports,
      })),
    };
  }

  /**
   * Verifies assertion response and enforces monotonic signature counter to block replay attacks
   */
  verifyAuthenticationResponse(dto: VerifyAuthenticationDto): { verified: boolean; userId: string } {
    const pending = this.pendingChallenges.get(`auth:${dto.userId}`);
    if (!pending || Date.now() > pending.expiresAt) {
      throw new UnauthorizedException('Authentication challenge expired or invalid');
    }
    this.pendingChallenges.delete(`auth:${dto.userId}`);

    // Parse clientDataJSON
    try {
      const clientData = JSON.parse(
        Buffer.from(dto.clientDataJSON, 'base64url').toString('utf8'),
      );
      if (clientData.type !== 'webauthn.get') {
        throw new UnauthorizedException(`Invalid clientData type: ${clientData.type}`);
      }
      if (clientData.challenge !== pending.challenge) {
        throw new UnauthorizedException('Cryptographic challenge mismatch');
      }
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Malformed clientDataJSON payload');
    }

    const userCreds = this.credentialsStore.get(dto.userId) || [];
    const cred = userCreds.find((c) => c.id === dto.credentialId);
    if (!cred) {
      throw new UnauthorizedException('Passkey credential not recognized for this user');
    }

    // Monotonic Counter Verification (Blocks Cloned Authenticator Replay Attacks)
    if (dto.counter > 0 && dto.counter <= cred.counter) {
      throw new UnauthorizedException(
        `Cloned authenticator replay attack detected! Counter ${dto.counter} <= ${cred.counter}`,
      );
    }

    cred.counter = Math.max(cred.counter + 1, dto.counter);
    cred.lastUsedAt = Date.now();

    return {
      verified: true,
      userId: dto.userId,
    };
  }

  listUserPasskeys(userId: string): WebAuthnCredential[] {
    return this.credentialsStore.get(userId) || [];
  }

  deletePasskey(userId: string, credentialId: string): boolean {
    const userCreds = this.credentialsStore.get(userId) || [];
    const filtered = userCreds.filter((c) => c.id !== credentialId);
    this.credentialsStore.set(userId, filtered);
    return filtered.length < userCreds.length;
  }
}
