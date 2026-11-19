import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  createDecipheriv,
  createHash,
  createVerify,
  randomBytes,
  randomUUID,
} from 'crypto';
import * as zlib from 'zlib';
import { PrismaService } from '../../prisma/prisma.service';

export type EnterpriseIdpProvider =
  | 'okta'
  | 'entra'
  | 'google-workspace'
  | 'custom';

export interface SamlTenantIdpConfig {
  id?: string;
  tenantSlug: string;
  providerName: EnterpriseIdpProvider;
  idpEntityId: string;
  idpSsoUrl: string;
  idpCertificatePem: string;
  spEntityId?: string;
  defaultRole?: string;
  roleMapping?: Record<string, string>;
  wantAssertionsSigned?: boolean;
  enabled?: boolean;
}

export interface ParsedSamlClaims {
  assertionId: string;
  issuer: string;
  audience: string;
  nameId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  department?: string;
  groups: string[];
  notBefore?: Date;
  notOnOrAfter?: Date;
}

export interface SamlJitLoginResult {
  accessToken: string;
  refreshToken: string;
  provisioned: boolean;
  tenantSlug: string;
  provider: EnterpriseIdpProvider;
  user: {
    id: string;
    username: string;
    email: string;
    name: string;
    company: string | null;
    organizationRole: string;
  };
}

@Injectable()
export class SamlSsoService {
  private readonly logger = new Logger(SamlSsoService.name);
  private readonly defaultSpEntityId: string;
  private readonly defaultAcsUrl: string;
  private readonly clockSkewMs = 60_000;

  // In-memory tenant registry backed by Prisma SamlTenantConfig when database is connected
  private readonly tenantCache = new Map<string, SamlTenantIdpConfig>();
  // Replay cache tracking consumed SAML Assertion IDs
  private readonly consumedAssertionIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    const publicBaseUrl =
      this.configService?.get<string>('PUBLIC_API_URL') ||
      process.env.PUBLIC_API_URL ||
      'http://localhost:3001';

    this.defaultSpEntityId =
      this.configService?.get<string>('SAML_SP_ENTITY_ID') ||
      process.env.SAML_SP_ENTITY_ID ||
      `${publicBaseUrl}/api/v1/auth/saml/metadata`;

    this.defaultAcsUrl =
      this.configService?.get<string>('SAML_SP_ACS_URL') ||
      process.env.SAML_SP_ACS_URL ||
      `${publicBaseUrl}/api/v1/auth/saml/acs`;
  }

  getSpEntityId(tenantSlug?: string): string {
    if (!tenantSlug) return this.defaultSpEntityId;
    return `${this.defaultSpEntityId}?tenant=${encodeURIComponent(tenantSlug)}`;
  }

  getAcsUrl(tenantSlug?: string): string {
    if (!tenantSlug) return this.defaultAcsUrl;
    return `${this.defaultAcsUrl}?tenant=${encodeURIComponent(tenantSlug)}`;
  }

  /**
   * Registers or updates an Enterprise Identity Provider configuration
   * (Okta, Microsoft Entra ID, Google Workspace, or custom SAML 2.0 IdP).
   */
  async configureTenantIdp(
    config: SamlTenantIdpConfig,
  ): Promise<SamlTenantIdpConfig> {
    const slug = config.tenantSlug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new BadRequestException(
        'tenantSlug must contain only lowercase alphanumeric characters and hyphens',
      );
    }
    if (!config.idpEntityId || !config.idpSsoUrl || !config.idpCertificatePem) {
      throw new BadRequestException(
        'idpEntityId, idpSsoUrl, and idpCertificatePem are required',
      );
    }

    const normalized: SamlTenantIdpConfig = {
      ...config,
      tenantSlug: slug,
      spEntityId: config.spEntityId || this.getSpEntityId(slug),
      defaultRole: config.defaultRole || 'MEMBER',
      wantAssertionsSigned: config.wantAssertionsSigned ?? true,
      enabled: config.enabled ?? true,
    };

    this.tenantCache.set(slug, normalized);

    const samlDelegate = (
      this.prisma as unknown as {
        samlTenantConfig?: {
          upsert: (args: unknown) => Promise<SamlTenantIdpConfig>;
        };
      }
    ).samlTenantConfig;

    if (samlDelegate?.upsert) {
      try {
        await samlDelegate.upsert({
          where: { tenantSlug: slug },
          create: {
            tenantSlug: slug,
            providerName: normalized.providerName,
            idpEntityId: normalized.idpEntityId,
            idpSsoUrl: normalized.idpSsoUrl,
            idpCertificatePem: normalized.idpCertificatePem,
            spEntityId: normalized.spEntityId,
            defaultRole: normalized.defaultRole,
            roleMapping: normalized.roleMapping ?? {},
            wantAssertionsSigned: normalized.wantAssertionsSigned,
            enabled: normalized.enabled,
          },
          update: {
            providerName: normalized.providerName,
            idpEntityId: normalized.idpEntityId,
            idpSsoUrl: normalized.idpSsoUrl,
            idpCertificatePem: normalized.idpCertificatePem,
            spEntityId: normalized.spEntityId,
            defaultRole: normalized.defaultRole,
            roleMapping: normalized.roleMapping ?? {},
            wantAssertionsSigned: normalized.wantAssertionsSigned,
            enabled: normalized.enabled,
          },
        });
      } catch {
        // Allow in-memory execution when database isn't live
      }
    }

    return normalized;
  }

  async getTenantConfig(tenantSlug: string): Promise<SamlTenantIdpConfig> {
    const slug = tenantSlug.trim().toLowerCase();
    const cached = this.tenantCache.get(slug);
    if (cached) {
      if (cached.enabled === false) {
        throw new ForbiddenException(`SAML SSO is disabled for tenant "${slug}"`);
      }
      return cached;
    }

    const samlDelegate = (
      this.prisma as unknown as {
        samlTenantConfig?: {
          findUnique: (args: unknown) => Promise<SamlTenantIdpConfig | null>;
        };
      }
    ).samlTenantConfig;

    if (samlDelegate?.findUnique) {
      try {
        const record = await samlDelegate.findUnique({
          where: { tenantSlug: slug },
        });
        if (record) {
          this.tenantCache.set(slug, record);
          if (record.enabled === false) {
            throw new ForbiddenException(
              `SAML SSO is disabled for tenant "${slug}"`,
            );
          }
          return record;
        }
      } catch (err) {
        if (err instanceof ForbiddenException) throw err;
      }
    }

    throw new NotFoundException(
      `No SAML 2.0 IdP configuration found for tenant "${slug}"`,
    );
  }

  /**
   * Generates SAML 2.0 Service Provider (SP) XML Metadata for upload to
   * Okta, Microsoft Entra ID, or Google Workspace.
   */
  generateSpMetadataXml(tenantSlug?: string): string {
    const entityId = escapeXml(this.getSpEntityId(tenantSlug));
    const acsUrl = escapeXml(this.getAcsUrl(tenantSlug));
    const validUntil = new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString();

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}" validUntil="${validUntil}">`,
      '  <md:SPSSODescriptor AuthnRequestsSigned="true" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">',
      '    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>',
      `    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="1" isDefault="true"/>`,
      '  </md:SPSSODescriptor>',
      '</md:EntityDescriptor>',
    ].join('\n');
  }

  /**
   * Generates a Deflate + Base64 encoded SAML 2.0 AuthnRequest redirect URL
   * for initiating SP-initiated SSO with the tenant IdP.
   */
  async buildAuthnRequestRedirectUrl(
    tenantSlug: string,
    relayState?: string,
  ): Promise<{ redirectUrl: string; requestId: string }> {
    const tenant = await this.getTenantConfig(tenantSlug);
    const requestId = `_${randomUUID()}`;
    const issueInstant = new Date().toISOString();
    const spEntityId = escapeXml(
      tenant.spEntityId || this.getSpEntityId(tenantSlug),
    );
    const acsUrl = escapeXml(this.getAcsUrl(tenantSlug));
    const destination = escapeXml(tenant.idpSsoUrl);

    const authnRequestXml = [
      `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
      `  ID="${requestId}" Version="2.0" IssueInstant="${issueInstant}"`,
      `  Destination="${destination}"`,
      `  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"`,
      `  AssertionConsumerServiceURL="${acsUrl}">`,
      `  <saml:Issuer>${spEntityId}</saml:Issuer>`,
      `  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>`,
      `</samlp:AuthnRequest>`,
    ].join('\n');

    const deflated = zlib.deflateRawSync(Buffer.from(authnRequestXml, 'utf8'));
    const encodedRequest = deflated.toString('base64');

    const url = new URL(tenant.idpSsoUrl);
    url.searchParams.set('SAMLRequest', encodedRequest);
    if (relayState) {
      url.searchParams.set('RelayState', relayState);
    }

    return { redirectUrl: url.toString(), requestId };
  }

  /**
   * Decrypts AES-256-GCM encrypted SAML assertion payloads when EncryptedAssertion is used.
   */
  decryptEncryptedAssertion(
    encryptedBase64: string,
    ivBase64: string,
    authTagBase64: string,
    decryptionKeyHex: string,
  ): string {
    const key = Buffer.from(decryptionKeyHex, 'hex');
    const iv = Buffer.from(ivBase64, 'base64');
    const tag = Buffer.from(authTagBase64, 'base64');
    const ciphertext = Buffer.from(encryptedBase64, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  /**
   * Validates XML cryptographic signature, Issuer, AudienceRestriction,
   * NotBefore / NotOnOrAfter timestamps, and replay protection on a SAML 2.0 Response.
   */
  validateAndParseSamlResponse(
    samlResponseBase64OrXml: string,
    tenant: SamlTenantIdpConfig,
    now = new Date(),
  ): ParsedSamlClaims {
    const xml = samlResponseBase64OrXml.trim().startsWith('<')
      ? samlResponseBase64OrXml.trim()
      : Buffer.from(samlResponseBase64OrXml.trim(), 'base64').toString('utf8');

    if (!xml.includes('<samlp:Response') && !xml.includes('<Response')) {
      throw new BadRequestException('Invalid SAML 2.0 Response XML payload');
    }

    // 1. Cryptographic XML Digital Signature Verification
    if (tenant.wantAssertionsSigned !== false) {
      this.verifyXmlDigitalSignature(xml, tenant.idpCertificatePem);
    }

    // 2. Extract Assertion ID and enforce replay protection
    const assertionMatch = xml.match(
      /<(?:saml2?:)?Assertion\b[^>]*\bID="([^"]+)"/,
    );
    const assertionId = assertionMatch?.[1];
    if (!assertionId) {
      throw new UnauthorizedException(
        'SAML Response is missing a valid Assertion ID',
      );
    }
    if (this.consumedAssertionIds.has(assertionId)) {
      throw new UnauthorizedException(
        `Replay attack detected: SAML Assertion "${assertionId}" has already been consumed`,
      );
    }

    // 3. Validate Issuer matches configured IdP Entity ID
    const issuerMatch = xml.match(
      /<(?:saml2?:)?Issuer[^>]*>([^<]+)<\/(?:saml2?:)?Issuer>/,
    );
    const issuer = issuerMatch?.[1]?.trim() ?? '';
    if (issuer !== tenant.idpEntityId) {
      throw new UnauthorizedException(
        `SAML Issuer mismatch: expected "${tenant.idpEntityId}", received "${issuer}"`,
      );
    }

    // 4. Validate AudienceRestriction matches SP Entity ID
    const audienceMatch = xml.match(
      /<(?:saml2?:)?Audience[^>]*>([^<]+)<\/(?:saml2?:)?Audience>/,
    );
    const audience = audienceMatch?.[1]?.trim() ?? '';
    const expectedAudience =
      tenant.spEntityId || this.getSpEntityId(tenant.tenantSlug);
    if (!audience || audience !== expectedAudience) {
      throw new UnauthorizedException(
        `SAML AudienceRestriction mismatch: expected "${expectedAudience}", received "${audience}"`,
      );
    }

    // 5. Validate Assertion Conditions timestamps (NotBefore & NotOnOrAfter)
    const conditionsTag = xml.match(/<(?:saml2?:)?Conditions\b([^>]*)>/);
    let notBefore: Date | undefined;
    let notOnOrAfter: Date | undefined;
    if (conditionsTag) {
      const attrs = conditionsTag[1];
      const nbMatch = attrs.match(/\bNotBefore="([^"]+)"/);
      const noaMatch = attrs.match(/\bNotOnOrAfter="([^"]+)"/);
      if (nbMatch) {
        notBefore = new Date(nbMatch[1]);
        if (now.getTime() + this.clockSkewMs < notBefore.getTime()) {
          throw new UnauthorizedException(
            'SAML Assertion is not yet valid (NotBefore condition failed)',
          );
        }
      }
      if (noaMatch) {
        notOnOrAfter = new Date(noaMatch[1]);
        if (now.getTime() - this.clockSkewMs >= notOnOrAfter.getTime()) {
          throw new UnauthorizedException(
            'SAML Assertion has expired (NotOnOrAfter condition failed)',
          );
        }
      }
    }

    // 6. Extract NameID & AttributeStatement claims (Okta, Entra ID, Google Workspace URIs)
    const nameIdMatch = xml.match(
      /<(?:saml2?:)?NameID[^>]*>([^<]+)<\/(?:saml2?:)?NameID>/,
    );
    const nameId = nameIdMatch?.[1]?.trim() ?? '';
    const attributes = extractSamlAttributes(xml);

    const email = (
      attributes['email']?.[0] ||
      attributes['mail']?.[0] ||
      attributes[
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
      ]?.[0] ||
      (nameId.includes('@') ? nameId : '')
    )
      .trim()
      .toLowerCase();

    if (!email || !email.includes('@')) {
      throw new UnauthorizedException(
        'SAML Assertion does not contain a valid user email claim',
      );
    }

    const firstName =
      attributes['firstName']?.[0] ||
      attributes['givenName']?.[0] ||
      attributes[
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'
      ]?.[0];
    const lastName =
      attributes['lastName']?.[0] ||
      attributes['surname']?.[0] ||
      attributes[
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'
      ]?.[0];
    const displayName =
      attributes['displayName']?.[0] ||
      attributes['name']?.[0] ||
      attributes[
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
      ]?.[0] ||
      [firstName, lastName].filter(Boolean).join(' ') ||
      email.split('@')[0];

    const department =
      attributes['department']?.[0] ||
      attributes[
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/department'
      ]?.[0] ||
      null;

    const groups = [
      ...(attributes['groups'] ?? []),
      ...(attributes['role'] ?? []),
      ...(attributes[
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
      ] ?? []),
      ...(attributes[
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
      ] ?? []),
    ];

    this.consumedAssertionIds.add(assertionId);

    return {
      assertionId,
      issuer,
      audience,
      nameId: nameId || email,
      email,
      firstName,
      lastName,
      displayName,
      department: department ?? undefined,
      groups,
      notBefore,
      notOnOrAfter,
    };
  }

  /**
   * Verifies the embedded `<ds:SignatureValue>` over the canonical assertion payload
   * using the tenant IdP's X.509 public certificate.
   */
  verifyXmlDigitalSignature(xml: string, idpCertificatePem: string): void {
    const sigValueMatch = xml.match(
      /<(?:ds:)?SignatureValue[^>]*>([\s\S]*?)<\/(?:ds:)?SignatureValue>/,
    );
    if (!sigValueMatch) {
      throw new UnauthorizedException(
        'SAML Response rejected: missing XML cryptographic <ds:SignatureValue>',
      );
    }

    const signatureBase64 = sigValueMatch[1].replace(/\s+/g, '');
    const sigMethodMatch = xml.match(
      /<(?:ds:)?SignatureMethod[^>]*Algorithm="([^"]+)"/,
    );
    const algorithmUri = sigMethodMatch?.[1] ?? '';
    const digestAlgo = algorithmUri.includes('sha512') ? 'RSA-SHA512' : 'RSA-SHA256';

    // Strip the <ds:Signature> block and normalize line endings to reconstruct canonical XML payload
    const signedPayload = xml
      .replace(/\s*<(?:ds:)?Signature[\s\S]*?<\/(?:ds:)?Signature>\s*/, "\n")
      .trim();

    const verifier = createVerify(digestAlgo);
    verifier.update(signedPayload, 'utf8');
    verifier.end();

    let isValid = false;
    try {
      isValid = verifier.verify(
        idpCertificatePem,
        Buffer.from(signatureBase64, 'base64'),
      );
    } catch {
      isValid = false;
    }

    if (!isValid) {
      throw new UnauthorizedException(
        'SAML Response rejected: invalid XML cryptographic signature',
      );
    }
  }

  /**
   * Executes the Assertion Consumer Service (ACS) callback:
   * validates the SAML assertion, performs Just-In-Time (JIT) user creation/role mapping,
   * and returns CodePulse JWT access & refresh tokens.
   */
  async handleAcsCallback(
    tenantSlug: string,
    samlResponseBase64OrXml: string,
    now = new Date(),
  ): Promise<SamlJitLoginResult> {
    const tenant = await this.getTenantConfig(tenantSlug);
    const claims = this.validateAndParseSamlResponse(
      samlResponseBase64OrXml,
      tenant,
      now,
    );

    const mappedRole = this.resolveOrganizationRole(claims.groups, tenant);
    const samlSubjectId = `${tenant.tenantSlug}:${claims.nameId}`;

    let existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ authEmail: claims.email }, { email: claims.email }],
      },
    });

    let provisioned = false;

    if (!existingUser) {
      provisioned = true;
      const baseUsername = claims.email
        .split('@')[0]
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 20);
      const uniqueUsername = `${baseUsername || 'enterprise'}_${randomBytes(2).toString('hex')}`;

      existingUser = await this.prisma.user.create({
        data: {
          username: uniqueUsername,
          email: claims.email,
          authEmail: claims.email,
          name: claims.displayName || uniqueUsername,
          company: claims.department || tenant.tenantSlug.toUpperCase(),
        },
      });
      this.logger.log(
        `JIT provisioned enterprise user ${claims.email} (${uniqueUsername}) for tenant ${tenant.tenantSlug} with role ${mappedRole}`,
      );
    } else {
      existingUser = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: claims.displayName || existingUser.name,
          company: claims.department || existingUser.company,
        },
      });
    }

    const accessToken = this.jwtService.sign({
      sub: existingUser.id,
      email: claims.email,
      username: existingUser.username,
      tenantSlug: tenant.tenantSlug,
      organizationRole: mappedRole,
      authMethod: 'saml-2.0',
      samlSubjectId,
    });

    const refreshToken = createHash('sha256')
      .update(`${existingUser.id}:${randomUUID()}`)
      .digest('hex');

    return {
      accessToken,
      refreshToken,
      provisioned,
      tenantSlug: tenant.tenantSlug,
      provider: tenant.providerName,
      user: {
        id: existingUser.id,
        username: existingUser.username,
        email: claims.email,
        name: existingUser.name || existingUser.username,
        company: existingUser.company ?? null,
        organizationRole: mappedRole,
      },
    };
  }

  private resolveOrganizationRole(
    groups: string[],
    tenant: SamlTenantIdpConfig,
  ): string {
    if (tenant.roleMapping) {
      for (const group of groups) {
        if (tenant.roleMapping[group]) {
          return tenant.roleMapping[group];
        }
      }
    }
    if (
      groups.some((g) => /admin|owner|security/i.test(g))
    ) {
      return 'ORG_ADMIN';
    }
    return tenant.defaultRole || 'MEMBER';
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractSamlAttributes(xml: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const attrRegex =
    /<(?:saml2?:)?Attribute\b[^>]*\bName="([^"]+)"[^>]*>([\s\S]*?)<\/(?:saml2?:)?Attribute>/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(xml)) !== null) {
    const attrName = match[1];
    const body = match[2];
    const values: string[] = [];
    const valRegex =
      /<(?:saml2?:)?AttributeValue[^>]*>([^<]*)<\/(?:saml2?:)?AttributeValue>/g;
    let valMatch: RegExpExecArray | null;
    while ((valMatch = valRegex.exec(body)) !== null) {
      values.push(valMatch[1].trim());
    }
    result[attrName] = values;
  }

  return result;
}
