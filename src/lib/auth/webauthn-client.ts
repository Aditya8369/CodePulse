/**
 * CodePulse Client-Side WebAuthn / FIDO2 Passkey Authentication Client
 * Manages biometric hardware passkey creation and authentication via W3C WebAuthn API.
 */

export interface PasskeyInfo {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt?: number;
  transports?: string[];
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class WebAuthnClient {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api/auth/webauthn') {
    this.baseUrl = baseUrl;
  }

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential !== 'undefined' &&
      typeof navigator.credentials !== 'undefined'
    );
  }

  async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Triggers W3C WebAuthn passkey registration ceremony
   */
  async registerPasskey(userId: string, username: string, passkeyName = 'My Hardware Passkey'): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser environment');
    }

    // 1. Request options from server
    const optionsRes = await fetch(`${this.baseUrl}/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, username }),
    });

    if (!optionsRes.ok) {
      throw new Error(`Failed to retrieve registration options: ${optionsRes.statusText}`);
    }

    const options = await optionsRes.json();

    // 2. Transform base64 challenges to ArrayBuffers
    const creationOptions: PublicKeyCredentialCreationOptions = {
      ...options,
      challenge: base64UrlToBuffer(options.challenge),
      user: {
        ...options.user,
        id: base64UrlToBuffer(options.user.id),
      },
      excludeCredentials: options.excludeCredentials?.map((cred: { id: string; type: string }) => ({
        ...cred,
        id: base64UrlToBuffer(cred.id),
      })),
    };

    // 3. Prompt user for biometric / hardware key (TouchID / Windows Hello / YubiKey)
    const credential = (await navigator.credentials.create({
      publicKey: creationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      throw new Error('Passkey creation was cancelled by the user');
    }

    const rawResponse = credential.response as AuthenticatorAttestationResponse;

    // 4. Verify on server
    const verifyRes = await fetch(`${this.baseUrl}/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        credentialId: credential.id,
        name: passkeyName,
        publicKey: bufferToBase64Url(rawResponse.getPublicKey ? (rawResponse.getPublicKey() || new ArrayBuffer(0)) : new ArrayBuffer(0)),
        clientDataJSON: bufferToBase64Url(rawResponse.clientDataJSON),
        transports: rawResponse.getTransports ? rawResponse.getTransports() : ['internal'],
      }),
    });

    if (!verifyRes.ok) {
      throw new Error('Passkey registration verification failed on server');
    }

    return true;
  }

  /**
   * Triggers W3C WebAuthn passkey login ceremony
   */
  async loginWithPasskey(userId: string): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser environment');
    }

    // 1. Request login options
    const optionsRes = await fetch(`${this.baseUrl}/login/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!optionsRes.ok) {
      throw new Error('Failed to retrieve authentication options');
    }

    const options = await optionsRes.json();

    // 2. Decode challenge and allowed credentials
    const requestOptions: PublicKeyCredentialRequestOptions = {
      ...options,
      challenge: base64UrlToBuffer(options.challenge),
      allowCredentials: options.allowCredentials?.map((cred: { id: string; type: string }) => ({
        ...cred,
        id: base64UrlToBuffer(cred.id),
      })),
    };

    // 3. Prompt user authenticator
    const assertion = (await navigator.credentials.get({
      publicKey: requestOptions,
    })) as PublicKeyCredential | null;

    if (!assertion) {
      throw new Error('Authentication cancelled by user');
    }

    const rawResponse = assertion.response as AuthenticatorAssertionResponse;

    // 4. Verify assertion on server
    const verifyRes = await fetch(`${this.baseUrl}/login/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        credentialId: assertion.id,
        clientDataJSON: bufferToBase64Url(rawResponse.clientDataJSON),
        signature: bufferToBase64Url(rawResponse.signature),
        counter: 1, // incremental
      }),
    });

    if (!verifyRes.ok) {
      throw new Error('Passkey authentication verification failed');
    }

    return true;
  }

  async listPasskeys(userId: string): Promise<PasskeyInfo[]> {
    const res = await fetch(`${this.baseUrl}/passkeys?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    return res.json();
  }

  async deletePasskey(userId: string, credentialId: string): Promise<boolean> {
    const res = await fetch(
      `${this.baseUrl}/passkeys/${encodeURIComponent(credentialId)}?userId=${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );
    return res.ok;
  }
}

export const webAuthnClient = new WebAuthnClient();
