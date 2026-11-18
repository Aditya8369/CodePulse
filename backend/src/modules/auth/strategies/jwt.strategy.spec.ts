import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { VaultService } from '../../security/vault.service';
import * as jwt from 'jsonwebtoken';

describe('JwtStrategy with Dual-Key Rotation', () => {
  let strategy: JwtStrategy;
  let vaultService: VaultService;

  beforeEach(() => {
    vaultService = new VaultService({
      enabled: true,
      dualKeyWindowMs: 3600000, // 1 hour
    });

    const configService = {
      get: jest.fn((k) => (k === 'JWT_SECRET' ? 'config-secret' : null)),
      getOrThrow: jest.fn((k) => 'config-secret'),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(configService, vaultService);
  });

  afterEach(() => {
    vaultService.stopSchedulers();
  });

  it('validates a token signed with the current key', () => {
    const currentKey = vaultService.getCurrentJwtSigningKey();
    const token = jwt.sign({ sub: 'user-current' }, currentKey);

    const secretOrKeyProvider = (strategy as any)._secretOrKeyProvider;
    let selectedKey: string | undefined;

    secretOrKeyProvider(null, token, (err: any, key: string) => {
      expect(err).toBeNull();
      selectedKey = key;
    });

    expect(selectedKey).toBe(currentKey);
  });

  it('validates a token signed with previous key during the 1-hour dual-key transition window', () => {
    const initialKey = vaultService.getCurrentJwtSigningKey();
    const legacyToken = jwt.sign({ sub: 'user-legacy' }, initialKey);

    // Rotate to a new key
    vaultService.rotateJwtKey('brand-new-vault-key-after-rotation');
    const newKey = vaultService.getCurrentJwtSigningKey();

    expect(newKey).not.toBe(initialKey);

    const secretOrKeyProvider = (strategy as any)._secretOrKeyProvider;
    let selectedKey: string | undefined;

    secretOrKeyProvider(null, legacyToken, (err: any, key: string) => {
      expect(err).toBeNull();
      selectedKey = key;
    });

    // The strategy selects initialKey because it matches the legacy token signature
    expect(selectedKey).toBe(initialKey);
  });

  it('falls back to single config key when VaultService is not provided', () => {
    const configService = {
      get: jest.fn((k) => (k === 'JWT_SECRET' ? 'standalone-secret' : null)),
      getOrThrow: jest.fn((k) => 'standalone-secret'),
    } as unknown as ConfigService;

    const standaloneStrategy = new JwtStrategy(configService, undefined);
    const token = jwt.sign({ sub: 'user-standalone' }, 'standalone-secret');

    const secretOrKeyProvider = (standaloneStrategy as any)
      ._secretOrKeyProvider;
    let selectedKey: string | undefined;

    secretOrKeyProvider(null, token, (err: any, key: string) => {
      expect(err).toBeNull();
      selectedKey = key;
    });

    expect(selectedKey).toBe('standalone-secret');
  });

  it('correctly maps valid payload in validate()', () => {
    const res = strategy.validate({
      sub: 'user-123',
      githubId: 'gh-456',
      username: 'dev',
      email: 'dev@test.com',
    });

    expect(res).toEqual({
      id: 'user-123',
      githubId: 'gh-456',
      username: 'dev',
      email: 'dev@test.com',
    });
  });
});
