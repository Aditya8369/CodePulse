import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { OAuthPkceService } from './oauth-pkce.service';
import { TokenRotationService } from './token-rotation.service';

describe('RFC 7636 PKCE & Cryptographic Token Rotation Mesh', () => {
  describe('OAuthPkceService', () => {
    let pkceService: OAuthPkceService;

    beforeEach(() => {
      pkceService = new OAuthPkceService();
    });

    it('generates compliant 64-char URL-safe code verifier and S256 challenge', () => {
      const verifier = pkceService.generateCodeVerifier(64);
      expect(verifier.length).toBe(64);

      const challenge = pkceService.generateCodeChallenge(verifier, 'S256');
      expect(challenge).toBeDefined();
      expect(challenge.length).toBeGreaterThan(40);
    });

    it('strictly prohibits plain code_challenge_method in compliance with OAuth 2.1', () => {
      const verifier = pkceService.generateCodeVerifier(64);
      expect(() => pkceService.generateCodeChallenge(verifier, 'plain')).toThrow(
        BadRequestException,
      );
    });

    it('issues single-use authorization code and verifies with correct verifier', () => {
      const verifier = pkceService.generateCodeVerifier(64);
      const challenge = pkceService.generateCodeChallenge(verifier, 'S256');

      const code = pkceService.issueAuthorizationCode({
        userId: 'user-pkce-1',
        clientId: 'codepulse-spa',
        redirectUri: 'https://codepulse.dev/callback',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      });

      expect(code.startsWith('cp_auth_')).toBe(true);

      const res = pkceService.verifyAndRedeemCode({
        code,
        codeVerifier: verifier,
        clientId: 'codepulse-spa',
        redirectUri: 'https://codepulse.dev/callback',
      });

      expect(res.userId).toBe('user-pkce-1');

      // Attempting to redeem the same code a second time must fail (single-use)
      expect(() =>
        pkceService.verifyAndRedeemCode({
          code,
          codeVerifier: verifier,
          clientId: 'codepulse-spa',
          redirectUri: 'https://codepulse.dev/callback',
        }),
      ).toThrow(UnauthorizedException);
    });

    it('rejects redemption with wrong code_verifier', () => {
      const verifier = pkceService.generateCodeVerifier(64);
      const challenge = pkceService.generateCodeChallenge(verifier, 'S256');

      const code = pkceService.issueAuthorizationCode({
        userId: 'user-pkce-2',
        clientId: 'codepulse-spa',
        redirectUri: 'https://codepulse.dev/callback',
        codeChallenge: challenge,
      });

      expect(() =>
        pkceService.verifyAndRedeemCode({
          code,
          codeVerifier: 'wrong-verifier-12345678901234567890123456789012345678901234',
          clientId: 'codepulse-spa',
          redirectUri: 'https://codepulse.dev/callback',
        }),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('TokenRotationService (Rotating Refresh Token Mesh & Theft Detection)', () => {
    let rotationService: TokenRotationService;

    beforeEach(() => {
      rotationService = new TokenRotationService();
    });

    it('issues initial token pair and seeds a new token family', () => {
      const pair = rotationService.issueInitialTokenPair('user-rtr-1', 'web-client');

      expect(pair.accessToken).toBeDefined();
      expect(pair.refreshToken.startsWith('cpr_')).toBe(true);
      expect(pair.familyId.startsWith('fam_')).toBe(true);
      expect(rotationService.isTokenFamilyActive(pair.familyId)).toBe(true);
    });

    it('rotates refresh token legitimately and updates active hash', () => {
      const pair1 = rotationService.issueInitialTokenPair('user-rtr-2', 'web-client');
      const pair2 = rotationService.rotateRefreshToken(pair1.refreshToken);

      expect(pair2.refreshToken).not.toBe(pair1.refreshToken);
      expect(pair2.familyId).toBe(pair1.familyId);
      expect(rotationService.isTokenFamilyActive(pair1.familyId)).toBe(true);

      const pair3 = rotationService.rotateRefreshToken(pair2.refreshToken);
      expect(pair3.refreshToken).not.toBe(pair2.refreshToken);
    });

    it('detects stolen token replay and immediately revokes the ENTIRE token family', () => {
      const pair1 = rotationService.issueInitialTokenPair('user-victim', 'web-client');
      // User rotates legitimately -> pair2 issued
      const pair2 = rotationService.rotateRefreshToken(pair1.refreshToken);

      expect(rotationService.isTokenFamilyActive(pair1.familyId)).toBe(true);

      // Adversary attempts to replay the already-used pair1.refreshToken!
      expect(() =>
        rotationService.rotateRefreshToken(pair1.refreshToken),
      ).toThrow(UnauthorizedException);

      // Verify the ENTIRE token family is now revoked!
      expect(rotationService.isTokenFamilyActive(pair1.familyId)).toBe(false);

      // Even the legitimate pair2 token can no longer be used
      expect(() =>
        rotationService.rotateRefreshToken(pair2.refreshToken),
      ).toThrow(UnauthorizedException);
    });
  });
});
