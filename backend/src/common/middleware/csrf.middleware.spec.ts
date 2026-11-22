import { CsrfMiddleware } from './csrf.middleware';
import {
  DEFAULT_CSRF_SECRET,
  generateCsrfToken,
  verifyCsrfTokenSignature,
} from '../security/csrf.util';

describe('CsrfMiddleware - Cryptographic CSRF Cookie Generation (#393)', () => {
  let middleware: CsrfMiddleware;

  beforeEach(() => {
    middleware = new CsrfMiddleware();
  });

  it('should generate a 256-bit signed token and set SameSite=Strict cookie when no cookie exists', () => {
    const cookiesSet: Record<string, { val: string; opts: any }> = {};
    const headersSet: Record<string, string> = {};

    const req: any = {
      headers: {},
      cookies: {},
      secure: false,
    };

    const res: any = {
      cookie: (name: string, val: string, opts: any) => {
        cookiesSet[name] = { val, opts };
      },
      setHeader: (name: string, val: string) => {
        headersSet[name] = val;
      },
    };

    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.csrfToken).toBeDefined();
    const token = req.csrfToken();
    expect(token).toBeDefined();

    // Verify token is valid 256-bit signed token
    expect(verifyCsrfTokenSignature(token, DEFAULT_CSRF_SECRET)).toBe(true);

    // Verify cookie was set
    expect(cookiesSet['csrf-token']).toBeDefined();
    expect(cookiesSet['csrf-token'].val).toBe(token);
    expect(cookiesSet['csrf-token'].opts.sameSite).toBe('strict');
    expect(cookiesSet['csrf-token'].opts.httpOnly).toBe(false);

    // Verify response header was set
    expect(headersSet['x-csrf-token']).toBe(token);
  });

  it('should set __Host-csrf-token with Secure=true when request is over HTTPS', () => {
    const cookiesSet: Record<string, { val: string; opts: any }> = {};

    const req: any = {
      headers: {
        'x-forwarded-proto': 'https',
      },
      cookies: {},
      secure: true,
    };

    const res: any = {
      cookie: (name: string, val: string, opts: any) => {
        cookiesSet[name] = { val, opts };
      },
      setHeader: jest.fn(),
    };

    const next = jest.fn();

    middleware.use(req, res, next);

    expect(cookiesSet['__Host-csrf-token']).toBeDefined();
    expect(cookiesSet['__Host-csrf-token'].opts.secure).toBe(true);
    expect(cookiesSet['__Host-csrf-token'].opts.sameSite).toBe('strict');
    expect(cookiesSet['__Host-csrf-token'].opts.httpOnly).toBe(false);
  });

  it('should reuse existing valid signed token from cookie', () => {
    const existingToken = generateCsrfToken(DEFAULT_CSRF_SECRET).token;
    const cookiesSet: Record<string, any> = {};

    const req: any = {
      headers: {
        cookie: `csrf-token=${existingToken}`,
      },
      cookies: {
        'csrf-token': existingToken,
      },
      secure: false,
    };

    const res: any = {
      cookie: (name: string, val: string, opts: any) => {
        cookiesSet[name] = val;
      },
      setHeader: jest.fn(),
    };

    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.csrfToken()).toBe(existingToken);
    expect(cookiesSet['csrf-token']).toBe(existingToken);
  });

  it('should regenerate a new signed token when existing cookie token has invalid signature', () => {
    const tamperedToken = 'invalid.forged_signature_hex_value_0123456789abcdef';

    const req: any = {
      headers: {
        cookie: `csrf-token=${tamperedToken}`,
      },
      cookies: {
        'csrf-token': tamperedToken,
      },
      secure: false,
    };

    const res: any = {
      cookie: jest.fn(),
      setHeader: jest.fn(),
    };

    const next = jest.fn();

    middleware.use(req, res, next);

    const generated = req.csrfToken();
    expect(generated).not.toBe(tamperedToken);
    expect(verifyCsrfTokenSignature(generated, DEFAULT_CSRF_SECRET)).toBe(true);
  });
});

