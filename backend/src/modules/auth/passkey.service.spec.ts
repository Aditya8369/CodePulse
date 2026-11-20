import { ForbiddenException } from '@nestjs/common';
import {
  createHash,
  createSign,
  generateKeyPairSync,
  KeyObject,
  randomBytes,
} from 'crypto';
import { AttestationValidatorService } from './attestation-validator.service';
import { PasskeyService } from './passkey.service';

function derLen(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len <= 0xff) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}
function derTlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLen(content.length), content]);
}
function derSeq(...items: Buffer[]): Buffer {
  return derTlv(0x30, Buffer.concat(items));
}
function derSet(...items: Buffer[]): Buffer {
  return derTlv(0x31, Buffer.concat(items));
}
function derInt(value: number | Buffer): Buffer {
  if (typeof value === 'number') {
    if (value === 0) return derTlv(0x02, Buffer.from([0x00]));
    const bytes: number[] = [];
    let v = value;
    while (v > 0) {
      bytes.unshift(v & 0xff);
      v >>= 8;
    }
    if (bytes[0] & 0x80) bytes.unshift(0x00);
    return derTlv(0x02, Buffer.from(bytes));
  }
  const buf = value[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), value]) : value;
  return derTlv(0x02, buf);
}
function derBitString(bytes: Buffer): Buffer {
  return derTlv(0x03, Buffer.concat([Buffer.from([0x00]), bytes]));
}
function derOid(oidBytes: number[]): Buffer {
  return derTlv(0x06, Buffer.from(oidBytes));
}
function derUtf8(str: string): Buffer {
  return derTlv(0x0c, Buffer.from(str, 'utf8'));
}
function derUtcTime(date: Date): Buffer {
  const yy = String(date.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return derTlv(0x17, Buffer.from(`${yy}${mm}${dd}${hh}${mi}${ss}Z`, 'ascii'));
}

function buildCert(params: {
  subjectCn: string;
  issuerCn: string;
  subjectPublicKey: KeyObject;
  issuerPrivateKey: KeyObject;
}): Buffer {
  const sigAlg = derSeq(derOid([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02]));
  const buildDn = (cn: string) =>
    derSeq(derSet(derSeq(derOid([0x55, 0x04, 0x03]), derUtf8(cn))));
  const validity = derSeq(
    derUtcTime(new Date(Date.now() - 86_400_000)),
    derUtcTime(new Date(Date.now() + 365 * 86_400_000)),
  );
  const spki = params.subjectPublicKey.export({ type: 'spki', format: 'der' });
  const tbs = derSeq(
    derTlv(0xa0, derInt(2)),
    derInt(randomBytes(8)),
    sigAlg,
    buildDn(params.issuerCn),
    validity,
    buildDn(params.subjectCn),
    spki,
  );
  const signer = createSign('SHA256');
  signer.update(tbs);
  signer.end();
  return derSeq(tbs, sigAlg, derBitString(signer.sign(params.issuerPrivateKey)));
}

function encodeCbor(val: unknown): Buffer {
  if (typeof val === 'number') {
    if (val >= 0) {
      return val < 24 ? Buffer.from([val]) : Buffer.from([24, val]);
    }
    const n = -1 - val;
    return n < 24 ? Buffer.from([0x20 | n]) : Buffer.from([0x20 | 24, n]);
  }
  if (Buffer.isBuffer(val)) {
    const len = val.length;
    const hdr =
      len < 24
        ? Buffer.from([0x40 | len])
        : len <= 0xff
          ? Buffer.from([0x40 | 24, len])
          : Buffer.from([0x40 | 25, (len >> 8) & 0xff, len & 0xff]);
    return Buffer.concat([hdr, val]);
  }
  if (typeof val === 'string') {
    const s = Buffer.from(val, 'utf8');
    const hdr =
      s.length < 24 ? Buffer.from([0x60 | s.length]) : Buffer.from([0x60 | 24, s.length]);
    return Buffer.concat([hdr, s]);
  }
  if (Array.isArray(val)) {
    return Buffer.concat([Buffer.from([0x80 | val.length]), ...val.map(encodeCbor)]);
  }
  if (val instanceof Map) {
    const out: Buffer[] = [Buffer.from([0xa0 | val.size])];
    for (const [k, v] of val.entries()) out.push(encodeCbor(k), encodeCbor(v));
    return Buffer.concat(out);
  }
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj);
  const out: Buffer[] = [Buffer.from([0xa0 | keys.length])];
  for (const k of keys) out.push(encodeCbor(k), encodeCbor(obj[k]));
  return Buffer.concat(out);
}

function buildAuthData(
  rpId: string,
  aaguidHex: string,
  credId: Buffer,
  pubKey: KeyObject,
): Buffer {
  const rpIdHash = createHash('sha256').update(rpId).digest();
  const flags = Buffer.from([0x45]);
  const signCount = Buffer.from([0, 0, 0, 1]);
  const aaguid = Buffer.from(aaguidHex.replace(/-/g, ''), 'hex');
  const credLen = Buffer.alloc(2);
  credLen.writeUInt16BE(credId.length, 0);
  const jwk = pubKey.export({ format: 'jwk' }) as { x: string; y: string };
  const cose = encodeCbor(
    new Map<number, unknown>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x, 'base64url')],
      [-3, Buffer.from(jwk.y, 'base64url')],
    ]),
  );
  return Buffer.concat([rpIdHash, flags, signCount, aaguid, credLen, credId, cose]);
}

describe('PasskeyService (Hardware-Only Policy & Registration Enforcement)', () => {
  let validator: AttestationValidatorService;
  let passkeyService: PasskeyService;
  let rootKeys: { publicKey: KeyObject; privateKey: KeyObject };
  let batchKeys: { publicKey: KeyObject; privateKey: KeyObject };
  let credKeys: { publicKey: KeyObject; privateKey: KeyObject };
  let batchCertDer: Buffer;

  const YUBIKEY_5_NFC_AAGUID = 'fa2b99dc-9e39-4257-8f92-4a30d23c4118';

  beforeEach(() => {
    validator = new AttestationValidatorService(undefined, {
      disableRedis: true,
    });
    passkeyService = new PasskeyService(validator, undefined, {
      rpId: 'codepulse.dev',
      expectedOrigin: 'https://codepulse.dev',
      disableRedis: true,
    });

    rootKeys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    batchKeys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    credKeys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

    const rootCertDer = buildCert({
      subjectCn: 'FIDO Root CA',
      issuerCn: 'FIDO Root CA',
      subjectPublicKey: rootKeys.publicKey,
      issuerPrivateKey: rootKeys.privateKey,
    });
    batchCertDer = buildCert({
      subjectCn: 'YubiKey Batch Cert',
      issuerCn: 'FIDO Root CA',
      subjectPublicKey: batchKeys.publicKey,
      issuerPrivateKey: rootKeys.privateKey,
    });

    validator.registerTrustedRootCa(rootCertDer);
  });

  it('rejects unattested software passkeys (fmt=none) for administrator accounts', async () => {
    const opts = await passkeyService.generateRegistrationOptions({
      userId: 'admin-1',
      username: 'sec-admin',
      userRole: 'ADMIN',
    });

    expect(opts.hardwareOnlyEnforced).toBe(true);
    expect(opts.authenticatorSelection.authenticatorAttachment).toBe(
      'cross-platform',
    );

    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.create',
        challenge: opts.challenge,
        origin: 'https://codepulse.dev',
      }),
    );
    const authData = buildAuthData(
      'codepulse.dev',
      '00000000-0000-0000-0000-000000000000',
      randomBytes(32),
      credKeys.publicKey,
    );
    const attestationObject = encodeCbor({
      fmt: 'none',
      authData,
      attStmt: {},
    });

    await expect(
      passkeyService.verifyAndRegisterPasskey({
        userId: 'admin-1',
        username: 'sec-admin',
        userRole: 'ADMIN',
        attestationObject,
        clientDataJSON,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects self-attested software passkeys for organization accounts enforcing hardware-only policy', async () => {
    passkeyService.setOrganizationPolicy('org-enterprise-1', {
      requireHardwareAttestation: true,
    });

    const opts = await passkeyService.generateRegistrationOptions({
      userId: 'dev-1',
      username: 'alice',
      userRole: 'DEVELOPER',
      organizationId: 'org-enterprise-1',
    });

    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.create',
        challenge: opts.challenge,
        origin: 'https://codepulse.dev',
      }),
    );
    const clientDataHash = createHash('sha256').update(clientDataJSON).digest();
    const authData = buildAuthData(
      'codepulse.dev',
      '00000000-0000-0000-0000-000000000000',
      randomBytes(32),
      credKeys.publicKey,
    );

    const signer = createSign('SHA256');
    signer.update(Buffer.concat([authData, clientDataHash]));
    signer.end();
    const sig = signer.sign(credKeys.privateKey);

    const attestationObject = encodeCbor({
      fmt: 'packed',
      authData,
      attStmt: { alg: -7, sig },
    });

    await expect(
      passkeyService.verifyAndRegisterPasskey({
        userId: 'dev-1',
        username: 'alice',
        userRole: 'DEVELOPER',
        organizationId: 'org-enterprise-1',
        attestationObject,
        clientDataJSON,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('approves and registers FIDO CA-verified YubiKey 5 NFC for administrator accounts and verifies assertions', async () => {
    const opts = await passkeyService.generateRegistrationOptions({
      userId: 'admin-2',
      username: 'root-admin',
      userRole: 'ADMIN',
    });

    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.create',
        challenge: opts.challenge,
        origin: 'https://codepulse.dev',
      }),
    );
    const clientDataHash = createHash('sha256').update(clientDataJSON).digest();
    const authData = buildAuthData(
      'codepulse.dev',
      YUBIKEY_5_NFC_AAGUID,
      randomBytes(32),
      credKeys.publicKey,
    );

    const signer = createSign('SHA256');
    signer.update(Buffer.concat([authData, clientDataHash]));
    signer.end();
    const sig = signer.sign(batchKeys.privateKey);

    const attestationObject = encodeCbor({
      fmt: 'packed',
      authData,
      attStmt: {
        alg: -7,
        sig,
        x5c: [batchCertDer],
      },
    });

    const registered = await passkeyService.verifyAndRegisterPasskey({
      userId: 'admin-2',
      username: 'root-admin',
      userRole: 'ADMIN',
      attestationObject,
      clientDataJSON,
    });

    expect(registered.credential.isHardwareBacked).toBe(true);
    expect(registered.credential.hardwareModelName).toBe('YubiKey 5 NFC');
    expect(registered.credential.aaguid).toBe(YUBIKEY_5_NFC_AAGUID);

    const authOpts =
      await passkeyService.generateAuthenticationOptions('admin-2');
    const assertClientData = Buffer.from(
      JSON.stringify({
        type: 'webauthn.get',
        challenge: authOpts.challenge,
        origin: 'https://codepulse.dev',
      }),
    );
    const assertClientHash = createHash('sha256')
      .update(assertClientData)
      .digest();
    const assertAuthData = Buffer.concat([
      createHash('sha256').update('codepulse.dev').digest(),
      Buffer.from([0x05]),
      Buffer.from([0, 0, 0, 2]),
    ]);

    const assertSigner = createSign('SHA256');
    assertSigner.update(Buffer.concat([assertAuthData, assertClientHash]));
    assertSigner.end();
    const assertSig = assertSigner.sign(credKeys.privateKey);

    const verified = await passkeyService.verifyAuthenticationAssertion({
      userId: 'admin-2',
      credentialId: registered.credential.credentialId,
      authenticatorData: assertAuthData,
      clientDataJSON: assertClientData,
      signature: assertSig,
    });

    expect(verified.verified).toBe(true);
    expect(verified.newSignCount).toBe(2);
  });
});
