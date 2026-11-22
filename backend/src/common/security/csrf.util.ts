import * as crypto from 'crypto';

export interface CsrfTokenDetails {
  rawToken: string;
  signature: string;
  token: string;
}

export const DEFAULT_CSRF_SECRET =
  process.env.CSRF_SECRET ||
  process.env.JWT_SECRET ||
  'codepulse-csrf-secure-hmac-secret-key-32b-entropy';

export const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generates a signed, cryptographically random 256-bit CSRF token.
 */
export function generateCsrfToken(
  secret: string = DEFAULT_CSRF_SECRET,
): CsrfTokenDetails {
  // 256-bit cryptographically random entropy (32 bytes = 64 hex characters)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(rawToken)
    .digest('hex');
  const token = `${rawToken}.${signature}`;

  return { rawToken, signature, token };
}

/**
 * Validates the HMAC-SHA256 signature of a CSRF token using constant-time comparison.
 */
export function verifyCsrfTokenSignature(
  token?: string | null,
  secret: string = DEFAULT_CSRF_SECRET,
): boolean {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [rawToken, signature] = parts;
  if (!rawToken || !signature || rawToken.length !== 64 || signature.length !== 64) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawToken)
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Compares header and cookie CSRF tokens in constant-time (timing-safe).
 */
export function compareCsrfTokens(
  headerToken?: string | null,
  cookieToken?: string | null,
): boolean {
  if (!headerToken || !cookieToken) return false;
  if (typeof headerToken !== 'string' || typeof cookieToken !== 'string') return false;

  const headerBuf = Buffer.from(headerToken, 'utf8');
  const cookieBuf = Buffer.from(cookieToken, 'utf8');

  if (headerBuf.length !== cookieBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(headerBuf, cookieBuf);
}

/**
 * Parses cookies from raw 'cookie' header string if req.cookies is not pre-populated.
 */
export function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader || typeof cookieHeader !== 'string') return {};

  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(';');

  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }

  return cookies;
}

/**
 * Extracts CSRF token from request cookies (__Host-csrf-token, csrf-token, XSRF-TOKEN).
 */
export function extractCsrfCookie(req: any): string | null {
  if (!req) return null;

  // 1. Check pre-parsed cookies
  if (req.cookies && typeof req.cookies === 'object') {
    if (req.cookies['__Host-csrf-token']) return req.cookies['__Host-csrf-token'];
    if (req.cookies['csrf-token']) return req.cookies['csrf-token'];
    if (req.cookies['XSRF-TOKEN']) return req.cookies['XSRF-TOKEN'];
  }

  // 2. Parse from headers.cookie
  const rawCookieHeader = req.headers?.cookie;
  if (rawCookieHeader) {
    const parsed = parseCookieHeader(rawCookieHeader);
    if (parsed['__Host-csrf-token']) return parsed['__Host-csrf-token'];
    if (parsed['csrf-token']) return parsed['csrf-token'];
    if (parsed['XSRF-TOKEN']) return parsed['XSRF-TOKEN'];
  }

  return null;
}

/**
 * Extracts CSRF token from request headers (x-csrf-token, x-xsrf-token, etc.).
 */
export function extractCsrfHeader(req: any): string | null {
  if (!req || !req.headers) return null;

  const headerVal =
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token'] ||
    req.headers['csrf-token'];

  if (typeof headerVal === 'string') {
    return headerVal.trim();
  } else if (Array.isArray(headerVal) && headerVal[0]) {
    return headerVal[0].trim();
  }

  // Optional body fallback for form posts (_csrf)
  if (req.body && typeof req.body === 'object' && req.body._csrf) {
    return String(req.body._csrf).trim();
  }

  return null;
}

/**
 * Validates request Origin and Referer to reject untrusted cross-origin form submissions.
 */
export function validateRequestOrigin(
  req: any,
  allowedOrigins: string[] = [],
): boolean {
  const origin = req.headers?.origin;
  const referer = req.headers?.referer;
  const host = req.headers?.host;

  // If neither Origin nor Referer is present (e.g. same-origin GET/fetch in some HTTP clients), allow
  if (!origin && !referer) {
    return true;
  }

  // Check Origin header first
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (host && originUrl.host === host) {
        return true;
      }
      for (const allowed of allowedOrigins) {
        if (allowed === '*' || origin === allowed || originUrl.host === allowed) {
          return true;
        }
      }
      return false; // Cross-origin mismatch!
    } catch {
      return false;
    }
  }

  // Fallback to Referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (host && refererUrl.host === host) {
        return true;
      }
      for (const allowed of allowedOrigins) {
        if (allowed === '*' || refererUrl.origin === allowed || refererUrl.host === allowed) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  return true;
}

