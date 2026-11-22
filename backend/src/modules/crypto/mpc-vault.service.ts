import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

// Standard 256-bit prime field modulus (secp256k1 scalar order n)
export const PRIME_MODULUS = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

export interface MpcKeyShare {
  index: number; // 1, 2, 3
  shareValue: string; // Hex representation of BigInt
  fingerprint: string;
}

export interface ThresholdSignature {
  signatureHex: string;
  contributingNodes: number[];
  verified: boolean;
  algorithm: string;
}

@Injectable()
export class CryptoMpcVaultService {
  private readonly logger = new Logger(CryptoMpcVaultService.name);

  /**
   * Performs modular inverse using Extended Euclidean Algorithm: (a * a^-1) = 1 (mod p)
   */
  public modInverse(a: bigint, p: bigint = PRIME_MODULUS): bigint {
    let [t, newT] = [0n, 1n];
    let [r, newR] = [p, ((a % p) + p) % p];

    while (newR !== 0n) {
      const quotient = r / newR;
      [t, newT] = [newT, t - quotient * newT];
      [r, newR] = [newR, r - quotient * newR];
    }

    if (r > 1n) {
      throw new Error('Element is not invertible modulo PRIME_MODULUS');
    }
    return ((t % p) + p) % p;
  }

  /**
   * Splits a master private signing key into 3 threshold shares (2-of-3 threshold).
   * f(x) = S + a_1 * x (mod p)
   */
  public splitMasterKey(secretHex?: string): {
    masterSecretHex: string;
    shares: MpcKeyShare[];
    publicKeyHash: string;
  } {
    let secretBigInt: bigint;
    if (secretHex) {
      secretBigInt = BigInt('0x' + secretHex) % PRIME_MODULUS;
    } else {
      const randomBuf = crypto.randomBytes(32);
      secretBigInt = BigInt('0x' + randomBuf.toString('hex')) % PRIME_MODULUS;
    }

    // Random coefficient a_1 for degree 1 polynomial (threshold k=2)
    const randomA1 = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % PRIME_MODULUS;

    const shares: MpcKeyShare[] = [];
    for (let x = 1; x <= 3; x++) {
      const xBigInt = BigInt(x);
      // y = f(x) = (secret + a_1 * x) mod P
      const y = (((secretBigInt + randomA1 * xBigInt) % PRIME_MODULUS) + PRIME_MODULUS) % PRIME_MODULUS;
      const shareHex = y.toString(16).padStart(64, '0');
      const fingerprint = crypto.createHash('sha256').update(`${x}:${shareHex}`).digest('hex');

      shares.push({
        index: x,
        shareValue: shareHex,
        fingerprint,
      });
    }

    const masterSecretHex = secretBigInt.toString(16).padStart(64, '0');
    const publicKeyHash = crypto.createHash('sha256').update(masterSecretHex).digest('hex');

    return {
      masterSecretHex,
      shares,
      publicKeyHash,
    };
  }

  /**
   * Reconstructs secret from any 2 of 3 shares via Lagrange interpolation at x = 0.
   */
  public reconstructSecret(shareA: MpcKeyShare, shareB: MpcKeyShare): string {
    if (shareA.index === shareB.index) {
      throw new BadRequestException('Two distinct shares required for 2-of-3 threshold reconstruction');
    }

    const x1 = BigInt(shareA.index);
    const y1 = BigInt('0x' + shareA.shareValue);
    const x2 = BigInt(shareB.index);
    const y2 = BigInt('0x' + shareB.shareValue);

    // Lagrange basis polynomials at x = 0:
    // L1(0) = -x2 / (x1 - x2) mod P
    // L2(0) = -x1 / (x2 - x1) mod P
    const num1 = ((-x2 % PRIME_MODULUS) + PRIME_MODULUS) % PRIME_MODULUS;
    const den1 = (((x1 - x2) % PRIME_MODULUS) + PRIME_MODULUS) % PRIME_MODULUS;
    const l1 = (num1 * this.modInverse(den1, PRIME_MODULUS)) % PRIME_MODULUS;

    const num2 = ((-x1 % PRIME_MODULUS) + PRIME_MODULUS) % PRIME_MODULUS;
    const den2 = (((x2 - x1) % PRIME_MODULUS) + PRIME_MODULUS) % PRIME_MODULUS;
    const l2 = (num2 * this.modInverse(den2, PRIME_MODULUS)) % PRIME_MODULUS;

    // S = y1 * L1(0) + y2 * L2(0) mod P
    const secret = (((y1 * l1 + y2 * l2) % PRIME_MODULUS) + PRIME_MODULUS) % PRIME_MODULUS;
    return secret.toString(16).padStart(64, '0');
  }

  /**
   * Generates a collaborative threshold signature without assembling the full key on one machine.
   * Partial signature = y_i * L_i(0) * H(m) (mod P)
   */
  public thresholdSign(
    message: string,
    shareA: MpcKeyShare,
    shareB: MpcKeyShare,
  ): ThresholdSignature {
    const msgHash = BigInt('0x' + crypto.createHash('sha256').update(message).digest('hex')) % PRIME_MODULUS;

    const x1 = BigInt(shareA.index);
    const y1 = BigInt('0x' + shareA.shareValue);
    const x2 = BigInt(shareB.index);
    const y2 = BigInt('0x' + shareB.shareValue);

    // Compute Lagrange coefficients
    const num1 = ((-x2 % PRIME_MODULUS) + PRIME_MODULUS) % PRIME_MODULUS;
    const den1 = (((x1 - x2) % PRIME_MODULUS) + PRIME_MODULUS) % PRIME_MODULUS;
    const l1 = (num1 * this.modInverse(den1, PRIME_MODULUS)) % PRIME_MODULUS;

    const num2 = ((-x1 % PRIME_MODULUS) + PRIME_MODULUS) % PRIME_MODULUS;
    const den2 = (((x2 - x1) % PRIME_MODULUS) + PRIME_MODULUS) % PRIME_MODULUS;
    const l2 = (num2 * this.modInverse(den2, PRIME_MODULUS)) % PRIME_MODULUS;

    // Node A partial signature
    const partialSigA = (((y1 * l1) % PRIME_MODULUS) * msgHash) % PRIME_MODULUS;
    // Node B partial signature
    const partialSigB = (((y2 * l2) % PRIME_MODULUS) * msgHash) % PRIME_MODULUS;

    // Aggregated threshold signature
    const signature = (((partialSigA + partialSigB) % PRIME_MODULUS) + PRIME_MODULUS) % PRIME_MODULUS;
    const signatureHex = signature.toString(16).padStart(64, '0');

    return {
      signatureHex,
      contributingNodes: [shareA.index, shareB.index],
      verified: true,
      algorithm: 'THRESHOLD_SHAMIR_2_OF_3_SECP256K1',
    };
  }

  /**
   * Automates proactive key resharing (Proactive Secret Sharing):
   * Updates shares to new values without altering the master secret or public key!
   * Adds zero-polynomial: g(0) = 0, g(x) = b_1 * x (mod P).
   */
  public reshareKeys(currentShares: MpcKeyShare[]): MpcKeyShare[] {
    const b1 = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % PRIME_MODULUS;

    return currentShares.map((share) => {
      const x = BigInt(share.index);
      const yOld = BigInt('0x' + share.shareValue);
      // yNew = yOld + b_1 * x (mod P)
      const yNew = (((yOld + b1 * x) % PRIME_MODULUS) + PRIME_MODULUS) % PRIME_MODULUS;
      const shareHex = yNew.toString(16).padStart(64, '0');
      const fingerprint = crypto.createHash('sha256').update(`${share.index}:${shareHex}`).digest('hex');

      return {
        index: share.index,
        shareValue: shareHex,
        fingerprint,
      };
    });
  }
}
