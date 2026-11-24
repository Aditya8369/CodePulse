export class JWTBloomRevocationService {
  private revokedTokens = new Set<string>();

  public revoke(jti: string): void {
    this.revokedTokens.add(jti);
  }

  public isRevoked(jti: string): boolean {
    return this.revokedTokens.has(jti);
  }
}
