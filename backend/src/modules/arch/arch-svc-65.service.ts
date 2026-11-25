/**
 * Architecture Service 65: Multi-Region Static Asset Edge Router
 * Subsystem: Geo-Edge Routing
 */

export class StaticAssetEdgeRouterService {
  private cdnEdgeUrls = new Map<string, string>(); // regionCode -> edgeDomain

  public registerEdge(region: string, domain: string): void {
    this.cdnEdgeUrls.set(region.toLowerCase(), domain);
  }

  public resolveAssetUrl(clientCountry: string, assetPath: string): string {
    const region = clientCountry.toLowerCase();
    const domain = this.cdnEdgeUrls.get(region) || this.cdnEdgeUrls.get('default') || 'cdn.codepulse.io';
    const cleanPath = assetPath.startsWith('/') ? assetPath : '/' + assetPath;
    return 'https://' + domain + cleanPath;
  }
}
