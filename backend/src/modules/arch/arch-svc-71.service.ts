/**
 * Architecture Service 71: Microservice API Deprecation Warning Header Injector
 * Subsystem: Sunset Timeline Tracking
 */

export interface DeprecationPolicy {
  endpointPattern: RegExp;
  sunsetDate: string; // ISO format
  linkUrl: string;
}

export class ApiDeprecationHeaderInjectorService {
  private policies: DeprecationPolicy[] = [];

  public registerDeprecation(endpointPattern: RegExp, sunsetDate: string, linkUrl: string): void {
    this.policies.push({ endpointPattern, sunsetDate, linkUrl });
  }

  public injectHeaders(path: string, existingHeaders: Record<string, string>): Record<string, string> {
    const policy = this.policies.find(p => p.endpointPattern.test(path));
    if (!policy) return existingHeaders;

    return {
      ...existingHeaders,
      'Deprecation': '@' + Math.floor(new Date(policy.sunsetDate).getTime() / 1000),
      'Sunset': new Date(policy.sunsetDate).toUTCString(),
      'Link': '<' + policy.linkUrl + '>; rel="sunset"',
    };
  }
}
