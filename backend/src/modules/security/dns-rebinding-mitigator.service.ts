import { Injectable } from '@nestjs/common';

@Injectable()
export class DnsRebindingMitigatorService {
  private readonly cachedHostResolutions = new Map<string, string>();

  public pinDnsResolution(host: string, resolvedIp: string): { pinned: boolean; isInternal: boolean } {
    // If resolved IP is private/loopback, reject pinning
    if (resolvedIp.startsWith('127.') || resolvedIp.startsWith('10.') || resolvedIp.startsWith('192.168.')) {
      return { pinned: false, isInternal: true };
    }
    this.cachedHostResolutions.set(host, resolvedIp);
    return { pinned: true, isInternal: false };
  }

  public getPinnedIp(host: string): string | undefined {
    return this.cachedHostResolutions.get(host);
  }
}
