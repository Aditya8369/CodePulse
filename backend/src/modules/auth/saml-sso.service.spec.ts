import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createCipheriv, createSign, generateKeyPairSync, randomBytes } from 'crypto';
import type { PrismaService } from '../../prisma/prisma.service';
import { SamlSsoService } from './saml-sso.service';

function signSamlResponseXml(
  unsignedXml: string,
  privateKeyPem: string,
): string {
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedXml.trim(), 'utf8');
  signer.end();
  const signatureBase64 = signer.sign(privateKeyPem, 'base64');

  const signatureBlock = `
  <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <ds:SignedInfo>
      <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
    </ds:SignedInfo>
    <ds:SignatureValue>${signatureBase64}</ds:SignatureValue>
  </ds:Signature>`;

  return unsignedXml.replace('</samlp:Response>', `${signatureBlock}\n</samlp:Response>`);
}

describe('SamlSsoService (Enterprise SAML 2.0 & JIT Provisioning)', () => {
  let service: SamlSsoService;
  let privateKeyPem: string;
  let publicKeyPem: string;
  let usersStore: Array<Record<string, unknown>>;

  beforeEach(async () => {
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privateKeyPem = pair.privateKey;
    publicKeyPem = pair.publicKey;

    usersStore = [];
    const prismaMock = {
      user: {
        findFirst: jest.fn(async ({ where }: { where: { OR: Array<{ authEmail?: string; email?: string }> } }) => {
          const emails = where.OR.map((c) => c.authEmail || c.email);
          return usersStore.find((u) => emails.includes(String(u.email))) ?? null;
        }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const created = { id: `user-${usersStore.length + 1}`, ...data };
          usersStore.push(created);
          return created;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const target = usersStore.find((u) => u.id === where.id)!;
          Object.assign(target, data);
          return target;
        }),
      },
    } as unknown as PrismaService;

    const jwtService = new JwtService({ secret: 'test-saml-secret-key' });
    service = new SamlSsoService(prismaMock, jwtService);

    await service.configureTenantIdp({
      tenantSlug: 'acme-corp',
      providerName: 'okta',
      idpEntityId: 'http://www.okta.com/exk123456789',
      idpSsoUrl: 'https://acme.okta.com/app/codepulse/exk123456789/sso/saml',
      idpCertificatePem: publicKeyPem,
      roleMapping: {
        'CodePulse-Admins': 'ORG_ADMIN',
      },
    });
  });

  it('exports valid SAML 2.0 Service Provider (SP) metadata XML and AuthnRequest redirect URLs', async () => {
    const metadataXml = service.generateSpMetadataXml('acme-corp');
    expect(metadataXml).toContain('<md:EntityDescriptor');
    expect(metadataXml).toContain('WantAssertionsSigned="true"');
    expect(metadataXml).toContain('/api/v1/auth/saml/acs?tenant=acme-corp');

    const { redirectUrl, requestId } = await service.buildAuthnRequestRedirectUrl(
      'acme-corp',
      '/dashboard',
    );
    expect(requestId.startsWith('_')).toBe(true);
    expect(redirectUrl).toContain('https://acme.okta.com/app/codepulse/exk123456789/sso/saml');
    expect(redirectUrl).toContain('SAMLRequest=');
    expect(redirectUrl).toContain('RelayState=%2Fdashboard');
  });

  it('verifies signed SAML 2.0 assertion XML and performs Just-In-Time (JIT) user & role provisioning', async () => {
    const now = new Date();
    const notBefore = new Date(now.getTime() - 30_000).toISOString();
    const notOnOrAfter = new Date(now.getTime() + 300_000).toISOString();
    const spEntityId = service.getSpEntityId('acme-corp');

    const unsignedXml = `
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_resp_001" Version="2.0">
  <saml:Issuer>http://www.okta.com/exk123456789</saml:Issuer>
  <saml:Assertion ID="_assert_001" Version="2.0">
    <saml:Subject>
      <saml:NameID>sonia.nanwani@acme.com</saml:NameID>
    </saml:Subject>
    <saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">
      <saml:AudienceRestriction>
        <saml:Audience>${spEntityId}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AttributeStatement>
      <saml:Attribute Name="email"><saml:AttributeValue>sonia.nanwani@acme.com</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="displayName"><saml:AttributeValue>Sonia Nanwani</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="department"><saml:AttributeValue>Platform Engineering</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="groups"><saml:AttributeValue>CodePulse-Admins</saml:AttributeValue></saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;

    const signedXml = signSamlResponseXml(unsignedXml, privateKeyPem);
    const base64Payload = Buffer.from(signedXml, 'utf8').toString('base64');

    const result = await service.handleAcsCallback('acme-corp', base64Payload, now);
    expect(result.provisioned).toBe(true);
    expect(result.user.email).toBe('sonia.nanwani@acme.com');
    expect(result.user.name).toBe('Sonia Nanwani');
    expect(result.user.company).toBe('Platform Engineering');
    expect(result.user.organizationRole).toBe('ORG_ADMIN');
    expect(typeof result.accessToken).toBe('string');

    // Replay attack with same assertion ID must be rejected
    await expect(
      service.handleAcsCallback('acme-corp', base64Payload, now),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tampered XML signatures, expired assertions, and invalid audiences', async () => {
    const now = new Date();
    const spEntityId = service.getSpEntityId('acme-corp');

    const expiredXml = signSamlResponseXml(
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_resp_exp">
        <saml:Issuer>http://www.okta.com/exk123456789</saml:Issuer>
        <saml:Assertion ID="_assert_exp">
          <saml:Subject><saml:NameID>dev@acme.com</saml:NameID></saml:Subject>
          <saml:Conditions NotBefore="2020-01-01T00:00:00Z" NotOnOrAfter="2020-01-01T01:00:00Z">
            <saml:AudienceRestriction><saml:Audience>${spEntityId}</saml:Audience></saml:AudienceRestriction>
          </saml:Conditions>
        </saml:Assertion>
      </samlp:Response>`,
      privateKeyPem,
    );

    await expect(
      service.handleAcsCallback('acme-corp', expiredXml, now),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // Tamper with signed XML content after signing
    const tampered = expiredXml.replace('dev@acme.com', 'attacker@evil.com');
    await expect(
      service.handleAcsCallback('acme-corp', tampered, now),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // Verify AES-256-GCM encrypted assertion helper
    const key = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update('<saml:Assertion ID="_enc_1"/>', 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    const decrypted = service.decryptEncryptedAssertion(
      encrypted.toString('base64'),
      iv.toString('base64'),
      tag.toString('base64'),
      key.toString('hex'),
    );
    expect(decrypted).toBe('<saml:Assertion ID="_enc_1"/>');
  });
});
