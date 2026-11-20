import {
  createHash,
  createSign,
  generateKeyPairSync,
  KeyObject,
  randomBytes,
} from 'crypto';
import axios from 'axios';
import {
  AttestationValidatorService,
  MdsRedisLike,
} from './attestation-validator.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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

function derOctetString(bytes: Buffer): Buffer {
  return derTlv(0x04, bytes);
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

function buildX509CertDer(params: {
  subjectCn: string;
  issuerCn: string;
  subjectPublicKey: KeyObject;
  issuerPrivateKey: KeyObject;
  notBefore: Date;
  notAfter: Date;
  isCa?: boolean;
  aaguidHex?: string;
}): Buffer {
  const sigAlg = derSeq(derOid([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02]));
  const version = derTlv(0xa0, derInt(2));
  const serial = derInt(randomBytes(8));

  const buildDn = (cn: string) =>
    derSeq(derSet(derSeq(derOid([0x55, 0x04, 0x03]), derUtf8(cn))));

  const validity = derSeq(
    derUtcTime(params.notBefore),
    derUtcTime(params.notAfter),
  );

  const spkiDer = params.subjectPublicKey.export({
    type: 'spki',
    format: 'der',
  });

  const extensions: Buffer[] = [];
  if (params.isCa) {
    extensions.push(
      derSeq(
        derOid([0x55, 0x1d, 0x13]),
        Buffer.from([0x01, 0x01, 0xff]),
        derOctetString(derSeq(Buffer.from([0x01, 0x01, 0xff]))),
      ),
    );
  }
  if (params.aaguidHex) {
    const aaguidBytes = Buffer.from(params.aaguidHex.replace(/-/g, ''), 'hex');
    extensions.push(
      derSeq(
        derOid([0x2b, 0x06, 0x01, 0x04, 0x01, 0x82, 0xe5, 0x1c, 0x01, 0x01, 0x04]),
        derOctetString(derOctetString(aaguidBytes)),
      ),
    );
  }

  const tbsFields = [
    version,
    serial,
    sigAlg,
    buildDn(params.issuerCn),
    validity,
    buildDn(params.subjectCn),
    spkiDer,
  ];
  if (extensions.length > 0) {
    tbsFields.push(derTlv(0xa3, derSeq(...extensions)));
  }

  const tbsCertificate = derSeq(...tbsFields);
  const signer = createSign('SHA256');
  signer.update(tbsCertificate);
  signer.end();
  const signature = signer.sign(params.issuerPrivateKey);

  return derSeq(tbsCertificate, sigAlg, derBitString(signature));
}

function encodeCbor(val: unknown): Buffer {
  if (typeof val === 'number') {
    if (val >= 0) {
      if (val < 24) return Buffer.from([val]);
      if (val <= 0xff) return Buffer.from([24, val]);
      const b = Buffer.alloc(3);
      b[0] = 25;
      b.writeUInt16BE(val, 1);
      return b;
    } else {
      const n = -1 - val;
      if (n < 24) return Buffer.from([0x20 | n]);
      if (n <= 0xff) return Buffer.from([0x20 | 24, n]);
      const b = Buffer.alloc(3);
      b[0] = 0x20 | 25;
      b.writeUInt16BE(n, 1);
      return b;
    }
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
    const strBuf = Buffer.from(val, 'utf8');
    const len = strBuf.length;
    const hdr =
      len < 24
        ? Buffer.from([0x60 | len])
        : len <= 0xff
          ? Buffer.from([0x60 | 24, len])
          : Buffer.from([0x60 | 25, (len >> 8) & 0xff, len & 0xff]);
    return Buffer.concat([hdr, strBuf]);
  }
  if (Array.isArray(val)) {
    const hdr = Buffer.from([0x80 | val.length]);
    return Buffer.concat([hdr, ...val.map((item) => encodeCbor(item))]);
  }
  if (val && typeof val === 'object') {
    if (val instanceof Map) {
      const entries: Buffer[] = [Buffer.from([0xa0 | val.size])];
      for (const [k, v] of val.entries()) {
        entries.push(encodeCbor(k), encodeCbor(v));
      }
      return Buffer.concat(entries);
    }
    const keys = Object.keys(val);
    const entries: Buffer[] = [Buffer.from([0xa0 | keys.length])];
    for (const k of keys) {
      entries.push(encodeCbor(k), encodeCbor((val as Record<string, unknown>)[k]));
    }
    return Buffer.concat(entries);
  }
  throw new Error(`Unsupported CBOR test encoder value: ${String(val)}`);
}

function buildAuthenticatorData(params: {
  rpId: string;
  flags?: number;
  signCount?: number;
  aaguidHex: string;
  credentialId: Buffer;
  publicKey: KeyObject;
}): Buffer {
  const rpIdHash = createHash('sha256').update(params.rpId).digest();
  const flags = Buffer.from([params.flags ?? 0x45]);
  const signCountBuf = Buffer.alloc(4);
  signCountBuf.writeUInt32BE(params.signCount ?? 1, 0);

  const aaguidBytes = Buffer.from(params.aaguidHex.replace(/-/g, ''), 'hex');
  const credLenBuf = Buffer.alloc(2);
  credLenBuf.writeUInt16BE(params.credentialId.length, 0);

  const jwk = params.publicKey.export({ format: 'jwk' }) as {
    x: string;
    y: string;
  };
  const coseMap = new Map<number, unknown>([
    [1, 2],
    [3, -7],
    [-1, 1],
    [-2, Buffer.from(jwk.x, 'base64url')],
    [-3, Buffer.from(jwk.y, 'base64url')],
  ]);

  return Buffer.concat([
    rpIdHash,
    flags,
    signCountBuf,
    aaguidBytes,
    credLenBuf,
    params.credentialId,
    encodeCbor(coseMap),
  ]);
}

describe('AttestationValidatorService (WebAuthn FIDO CA Validation Engine)', () => {
  let service: AttestationValidatorService;
  let rootKeyPair: { publicKey: KeyObject; privateKey: KeyObject };
  let batchKeyPair: { publicKey: KeyObject; privateKey: KeyObject };
  let credKeyPair: { publicKey: KeyObject; privateKey: KeyObject };
  let rootCertDer: Buffer;
  let batchCertDer: Buffer;

  const YUBIKEY_5_NFC_AAGUID = 'fa2b99dc-9e39-4257-8f92-4a30d23c4118';
  const TITAN_KEY_AAGUID = '42b4fb4a-2866-43b2-9bf7-6c6669c2e5d3';
  const RP_ID = 'codepulse.dev';
  const ORIGIN = 'https://codepulse.dev';

  beforeEach(() => {
    service = new AttestationValidatorService(undefined, {
      disableRedis: true,
    });

    rootKeyPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    batchKeyPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    credKeyPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

    const now = new Date();
    const past = new Date(now.getTime() - 86_400_000);
    const future = new Date(now.getTime() + 365 * 86_400_000);

    rootCertDer = buildX509CertDer({
      subjectCn: 'Yubico U2F Root CA Serial 457200631',
      issuerCn: 'Yubico U2F Root CA Serial 457200631',
      subjectPublicKey: rootKeyPair.publicKey,
      issuerPrivateKey: rootKeyPair.privateKey,
      notBefore: past,
      notAfter: future,
      isCa: true,
    });

    batchCertDer = buildX509CertDer({
      subjectCn: 'Yubico FIDO2 Batch Attestation',
      issuerCn: 'Yubico U2F Root CA Serial 457200631',
      subjectPublicKey: batchKeyPair.publicKey,
      issuerPrivateKey: rootKeyPair.privateKey,
      notBefore: past,
      notAfter: future,
      isCa: false,
      aaguidHex: YUBIKEY_5_NFC_AAGUID,
    });

    service.registerTrustedRootCa(rootCertDer);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('validates packed full hardware attestation against trusted FIDO Root CA and identifies YubiKey 5 NFC via AAGUID', async () => {
    const challenge = randomBytes(32).toString('base64url');
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.create',
        challenge,
        origin: ORIGIN,
      }),
    );
    const clientDataHash = createHash('sha256').update(clientDataJSON).digest();

    const authData = buildAuthenticatorData({
      rpId: RP_ID,
      aaguidHex: YUBIKEY_5_NFC_AAGUID,
      credentialId: randomBytes(32),
      publicKey: credKeyPair.publicKey,
    });

    const signer = createSign('SHA256');
    signer.update(Buffer.concat([authData, clientDataHash]));
    signer.end();
    const sig = signer.sign(batchKeyPair.privateKey);

    const attestationObject = encodeCbor({
      fmt: 'packed',
      authData,
      attStmt: {
        alg: -7,
        sig,
        x5c: [batchCertDer],
      },
    });

    const result = await service.validateAttestation({
      attestationObject,
      clientDataJSON,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRpId: RP_ID,
    });

    expect(result.valid).toBe(true);
    expect(result.format).toBe('packed');
    expect(result.trustLevel).toBe('fido-hardware-ca');
    expect(result.isHardwareBacked).toBe(true);
    expect(result.aaguid).toBe(YUBIKEY_5_NFC_AAGUID);
    expect(result.hardwareModel.modelName).toBe('YubiKey 5 NFC');
    expect(result.hardwareModel.vendor).toBe('Yubico');
    expect(result.rootCaSubject).toContain('Yubico U2F Root CA');
  });

  it('validates FIDO-U2F hardware attestation statement and certificate chain', async () => {
    const challenge = randomBytes(32).toString('base64url');
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.create',
        challenge,
        origin: ORIGIN,
      }),
    );
    const clientDataHash = createHash('sha256').update(clientDataJSON).digest();
    const credentialId = randomBytes(32);

    const authData = buildAuthenticatorData({
      rpId: RP_ID,
      aaguidHex: '00000000-0000-0000-0000-000000000000',
      credentialId,
      publicKey: credKeyPair.publicKey,
    });

    const jwk = credKeyPair.publicKey.export({ format: 'jwk' }) as {
      x: string;
      y: string;
    };
    const publicKeyU2f = Buffer.concat([
      Buffer.from([0x04]),
      Buffer.from(jwk.x, 'base64url'),
      Buffer.from(jwk.y, 'base64url'),
    ]);
    const rpIdHash = createHash('sha256').update(RP_ID).digest();
    const u2fSignedPayload = Buffer.concat([
      Buffer.from([0x00]),
      rpIdHash,
      clientDataHash,
      credentialId,
      publicKeyU2f,
    ]);

    const signer = createSign('SHA256');
    signer.update(u2fSignedPayload);
    signer.end();
    const sig = signer.sign(batchKeyPair.privateKey);

    const attestationObject = encodeCbor({
      fmt: 'fido-u2f',
      authData,
      attStmt: {
        sig,
        x5c: [batchCertDer],
      },
    });

    const result = await service.validateAttestation({
      attestationObject,
      clientDataJSON,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRpId: RP_ID,
    });

    expect(result.valid).toBe(true);
    expect(result.format).toBe('fido-u2f');
    expect(result.trustLevel).toBe('fido-hardware-ca');
    expect(result.isHardwareBacked).toBe(true);
    expect(result.hardwareModel.modelName).toBe(
      'FIDO U2F Hardware Security Key',
    );
  });

  it('validates TPM 2.0 attestation (certInfo TPMS_ATTEST + pubArea TPMT_PUBLIC + AIK X.509 chain)', async () => {
    const challenge = randomBytes(32).toString('base64url');
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.create',
        challenge,
        origin: ORIGIN,
      }),
    );
    const clientDataHash = createHash('sha256').update(clientDataJSON).digest();

    const tpmAaguid = '08987058-cadc-4b81-b6e1-30de50dcbe96';
    const aikCertDer = buildX509CertDer({
      subjectCn: 'TPM 2.0 Attestation Identity Key',
      issuerCn: 'Yubico U2F Root CA Serial 457200631',
      subjectPublicKey: batchKeyPair.publicKey,
      issuerPrivateKey: rootKeyPair.privateKey,
      notBefore: new Date(Date.now() - 86_400_000),
      notAfter: new Date(Date.now() + 365 * 86_400_000),
      isCa: false,
      aaguidHex: tpmAaguid,
    });

    const authData = buildAuthenticatorData({
      rpId: RP_ID,
      aaguidHex: tpmAaguid,
      credentialId: randomBytes(32),
      publicKey: credKeyPair.publicKey,
    });

    const jwk = credKeyPair.publicKey.export({ format: 'jwk' }) as {
      x: string;
      y: string;
    };
    const xBuf = Buffer.from(jwk.x, 'base64url');
    const yBuf = Buffer.from(jwk.y, 'base64url');

    const pubArea = Buffer.concat([
      Buffer.from([0x00, 0x23]),
      Buffer.from([0x00, 0x0b]),
      Buffer.from([0x00, 0x04, 0x00, 0x72]),
      Buffer.from([0x00, 0x00]),
      Buffer.from([0x00, 0x10]),
      Buffer.from([0x00, 0x10]),
      Buffer.from([0x00, 0x03]),
      Buffer.from([0x00, 0x10]),
      Buffer.from([0x00, xBuf.length]),
      xBuf,
      Buffer.from([0x00, yBuf.length]),
      yBuf,
    ]);

    const pubAreaSha256 = createHash('sha256').update(pubArea).digest();
    const attestedName = Buffer.concat([
      Buffer.from([0x00, 0x0b]),
      pubAreaSha256,
    ]);
    const extraData = createHash('sha256')
      .update(Buffer.concat([authData, clientDataHash]))
      .digest();

    const certInfo = Buffer.concat([
      Buffer.from([0xff, 0x54, 0x43, 0x47]),
      Buffer.from([0x80, 0x17]),
      Buffer.from([0x00, 0x02, 0x00, 0x01]),
      Buffer.from([0x00, extraData.length]),
      extraData,
      Buffer.alloc(17, 0),
      Buffer.alloc(8, 0),
      Buffer.from([0x00, attestedName.length]),
      attestedName,
    ]);

    const signer = createSign('SHA256');
    signer.update(certInfo);
    signer.end();
    const sig = signer.sign(batchKeyPair.privateKey);

    const attestationObject = encodeCbor({
      fmt: 'tpm',
      authData,
      attStmt: {
        ver: '2.0',
        alg: -7,
        sig,
        certInfo,
        pubArea,
        x5c: [aikCertDer],
      },
    });

    const result = await service.validateAttestation({
      attestationObject,
      clientDataJSON,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRpId: RP_ID,
    });

    expect(result.valid).toBe(true);
    expect(result.format).toBe('tpm');
    expect(result.trustLevel).toBe('fido-hardware-ca');
    expect(result.isHardwareBacked).toBe(true);
    expect(result.hardwareModel.modelName).toBe('Windows Hello Hardware TPM');
  });

  it('rejects forged/untrusted X.509 attestation certificates not chaining to trusted FIDO Root CAs', async () => {
    const rogueKeyPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const rogueLeafDer = buildX509CertDer({
      subjectCn: 'Spoofed Hardware Token',
      issuerCn: 'Rogue Untrusted CA',
      subjectPublicKey: rogueKeyPair.publicKey,
      issuerPrivateKey: rogueKeyPair.privateKey,
      notBefore: new Date(Date.now() - 86_400_000),
      notAfter: new Date(Date.now() + 86_400_000),
      aaguidHex: YUBIKEY_5_NFC_AAGUID,
    });

    const challenge = randomBytes(32).toString('base64url');
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.create',
        challenge,
        origin: ORIGIN,
      }),
    );
    const clientDataHash = createHash('sha256').update(clientDataJSON).digest();
    const authData = buildAuthenticatorData({
      rpId: RP_ID,
      aaguidHex: YUBIKEY_5_NFC_AAGUID,
      credentialId: randomBytes(32),
      publicKey: credKeyPair.publicKey,
    });

    const signer = createSign('SHA256');
    signer.update(Buffer.concat([authData, clientDataHash]));
    signer.end();
    const sig = signer.sign(rogueKeyPair.privateKey);

    const attestationObject = encodeCbor({
      fmt: 'packed',
      authData,
      attStmt: {
        alg: -7,
        sig,
        x5c: [rogueLeafDer],
      },
    });

    await expect(
      service.validateAttestation({
        attestationObject,
        clientDataJSON,
        expectedChallenge: challenge,
        expectedOrigin: ORIGIN,
        expectedRpId: RP_ID,
      }),
    ).rejects.toThrow(/Untrusted attestation certificate chain/);
  });

  it('downloads and caches FIDO Alliance MDS3 Root CA certificates in Redis', async () => {
    const store = new Map<string, string>();
    const mockRedis: MdsRedisLike = {
      get: jest.fn(async (k: string) => store.get(k) ?? null),
      set: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
        return 'OK';
      }),
      disconnect: jest.fn(),
    };

    const mdsService = new AttestationValidatorService(undefined, {
      disableRedis: true,
    });
    mdsService.setRedisClient(mockRedis);

    const mdsPayload = {
      nextUpdate: '2026-12-01',
      entries: [
        {
          aaguid: TITAN_KEY_AAGUID,
          metadataStatement: {
            aaguid: TITAN_KEY_AAGUID,
            description: 'Google Titan Security Key MDS3',
            attestationRootCertificates: [rootCertDer.toString('base64')],
            authenticatorGetInfo: { transports: ['usb', 'nfc'] },
          },
          statusReports: [{ status: 'FIDO_CERTIFIED_L2' }],
        },
      ],
    };

    const jwtBlob = `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(
      JSON.stringify(mdsPayload),
    ).toString('base64url')}.signature`;

    mockedAxios.get.mockResolvedValueOnce({ data: jwtBlob });

    const first = await mdsService.loadMdsFromCacheOrRemote(false);
    expect(first.rootCertificatesPem).toHaveLength(1);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'fido:mds3:root-cas',
      expect.any(String),
      'EX',
      86400,
    );

    const second = await mdsService.loadMdsFromCacheOrRemote(false);
    expect(second.rootCertificatesPem).toHaveLength(1);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(
      mdsService.lookupHardwareByAaguid(TITAN_KEY_AAGUID, true).modelName,
    ).toBe('Google Titan Security Key MDS3');
  });
});
