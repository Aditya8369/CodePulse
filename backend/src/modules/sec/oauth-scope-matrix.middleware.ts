export class OAuthScopeMatrixMiddleware {
  private allowedGrantsByClientType: Record<string, string[]> = {
    SPA: ['authorization_code'],
    MOBILE: ['authorization_code'],
    SERVICE: ['client_credentials']
  };

  public validateGrantType(clientType: string, grantType: string): boolean {
    const allowed = this.allowedGrantsByClientType[clientType];
    return allowed ? allowed.includes(grantType) : false;
  }

  public hasRequiredScopes(tokenScopes: string[], requiredScopes: string[]): boolean {
    const tokenSet = new Set(tokenScopes);
    return requiredScopes.every(scope => tokenSet.has(scope));
  }
}
