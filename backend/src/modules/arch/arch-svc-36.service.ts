/**
 * Architecture Service 36: Domain Event Versioning Migration Middleware
 * Subsystem: Automated Schema Upgrading
 */

export interface VersionedDomainEvent<T = any> {
  eventType: string;
  version: number;
  payload: T;
}

export type Upcaster = (payload: any) => any;

export class DomainEventVersioningService {
  private upcasters = new Map<string, Upcaster>(); // eventType:fromVersion -> upcaster

  public registerUpcaster(eventType: string, fromVersion: number, upcaster: Upcaster): void {
    this.upcasters.set(eventType + ':' + fromVersion, upcaster);
  }

  public upcastEvent<T = any>(event: VersionedDomainEvent, targetVersion: number): VersionedDomainEvent<T> {
    let currentVersion = event.version;
    let payload = { ...event.payload };

    while (currentVersion < targetVersion) {
      const upcaster = this.upcasters.get(event.eventType + ':' + currentVersion);
      if (!upcaster) {
        throw new Error('No upcaster found for ' + event.eventType + ' from version ' + currentVersion);
      }
      payload = upcaster(payload);
      currentVersion++;
    }

    return {
      eventType: event.eventType,
      version: currentVersion,
      payload,
    };
  }
}
