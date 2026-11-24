export class CORSPreflightValidatorService {
  private allowedOriginPatterns: RegExp[] = [
    /^https:\/\/([a-zA-Z0-9-]+\.)?codepulse\.dev$/,
    /^https:\/\/([a-zA-Z0-9-]+\.)?codepulse\.com$/,
    /^http:\/\/localhost:(3000|5173|8080)$/
  ];

  public isOriginAllowed(origin: string): boolean {
    if (!origin) return false;
    return this.allowedOriginPatterns.some(pattern => pattern.test(origin));
  }

  public validatePreflight(origin: string, method: string): { allowed: boolean; headers: Record<string, string> } {
    if (!this.isOriginAllowed(origin)) {
      return { allowed: false, headers: {} };
    }

    return {
      allowed: true,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      }
    };
  }
}
