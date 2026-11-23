import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { WebAuthnService } from './webauthn.service';

describe('WebAuthnService (FIDO2 / Passkey Authentication)', () => {
  let service: WebAuthnService;

  beforeEach(() => {
    service = new WebAuthnService();
  });

  describe('Registration Ceremony', () => {
    it('generates registration options with cryptographic challenge and supported ES256/RS256 algorithms', () => {
      const options = service.generateRegistrationOptions('user-123', 'octocat');

      expect(options.challenge).toBeDefined();
      expect(options.challenge.length).toBeGreaterThan(20);
      expect(options.rp.name).toBe('CodePulse');
      expect(options.rp.id).toBe('codepulse.dev');
      expect(options.user.name).toBe('octocat');
      expect(options.pubKeyCredParams.some((p) => p.alg === -7)).toBe(true);
    });

    it('verifies registration response and persists credential with initial counter 0', () => {
      const options = service.generateRegistrationOptions('user-123', 'octocat');

      const clientDataJSON = Buffer.from(
        JSON.stringify({
          type: 'webauthn.create',
          challenge: options.challenge,
          origin: 'https://codepulse.dev',
        }),
      ).toString('base64url');

      const result = service.verifyRegistrationResponse({
        userId: 'user-123',
        credentialId: 'cred-key-abc',
        publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...',
        clientDataJSON,
        name: 'MacBook TouchID',
      });

      expect(result.verified).toBe(true);
      expect(result.credential.id).toBe('cred-key-abc');
      expect(result.credential.counter).toBe(0);
      expect(result.credential.name).toBe('MacBook TouchID');

      const userPasskeys = service.listUserPasskeys('user-123');
      expect(userPasskeys).toHaveLength(1);
    });

    it('rejects registration with challenge mismatch or invalid clientData type', () => {
      service.generateRegistrationOptions('user-123', 'octocat');

      const forgedClientData = Buffer.from(
        JSON.stringify({
          type: 'webauthn.create',
          challenge: 'forged-challenge-xyz',
          origin: 'https://codepulse.dev',
        }),
      ).toString('base64url');

      expect(() =>
        service.verifyRegistrationResponse({
          userId: 'user-123',
          credentialId: 'cred-fake',
          publicKey: 'key',
          clientDataJSON: forgedClientData,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('Authentication Ceremony & Replay Prevention', () => {
    beforeEach(() => {
      // Register a credential first
      const options = service.generateRegistrationOptions('user-auth-test', 'alice');
      const clientDataJSON = Buffer.from(
        JSON.stringify({
          type: 'webauthn.create',
          challenge: options.challenge,
          origin: 'https://codepulse.dev',
        }),
      ).toString('base64url');

      service.verifyRegistrationResponse({
        userId: 'user-auth-test',
        credentialId: 'cred-alice-yubikey',
        publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...',
        clientDataJSON,
        name: 'YubiKey 5C NFC',
      });
    });

    it('generates authentication options with allowCredentials list', () => {
      const options = service.generateAuthenticationOptions('user-auth-test');

      expect(options.challenge).toBeDefined();
      expect(options.allowCredentials).toHaveLength(1);
      expect(options.allowCredentials[0].id).toBe('cred-alice-yubikey');
    });

    it('verifies valid passkey authentication and advances signature counter', () => {
      const authOptions = service.generateAuthenticationOptions('user-auth-test');

      const clientDataJSON = Buffer.from(
        JSON.stringify({
          type: 'webauthn.get',
          challenge: authOptions.challenge,
          origin: 'https://codepulse.dev',
        }),
      ).toString('base64url');

      const res = service.verifyAuthenticationResponse({
        userId: 'user-auth-test',
        credentialId: 'cred-alice-yubikey',
        signature: 'MEQCIA72...',
        clientDataJSON,
        counter: 1, // advanced from 0 to 1
      });

      expect(res.verified).toBe(true);
      expect(res.userId).toBe('user-auth-test');
    });

    it('blocks cloned authenticator replay attack when counter does not strictly advance', () => {
      // First authentication at counter = 5
      const opt1 = service.generateAuthenticationOptions('user-auth-test');
      const clientData1 = Buffer.from(
        JSON.stringify({
          type: 'webauthn.get',
          challenge: opt1.challenge,
          origin: 'https://codepulse.dev',
        }),
      ).toString('base64url');

      service.verifyAuthenticationResponse({
        userId: 'user-auth-test',
        credentialId: 'cred-alice-yubikey',
        signature: 'sig-1',
        clientDataJSON: clientData1,
        counter: 5,
      });

      // Second authentication attempting to replay counter = 5 or counter = 3
      const opt2 = service.generateAuthenticationOptions('user-auth-test');
      const clientData2 = Buffer.from(
        JSON.stringify({
          type: 'webauthn.get',
          challenge: opt2.challenge,
          origin: 'https://codepulse.dev',
        }),
      ).toString('base64url');

      expect(() =>
        service.verifyAuthenticationResponse({
          userId: 'user-auth-test',
          credentialId: 'cred-alice-yubikey',
          signature: 'sig-replay',
          clientDataJSON: clientData2,
          counter: 5, // <= 5: Replay attack!
        }),
      ).toThrow(UnauthorizedException);
    });

    it('allows deleting registered passkeys', () => {
      const deleted = service.deletePasskey('user-auth-test', 'cred-alice-yubikey');
      expect(deleted).toBe(true);

      const passkeys = service.listUserPasskeys('user-auth-test');
      expect(passkeys).toHaveLength(0);
    });
  });
});
