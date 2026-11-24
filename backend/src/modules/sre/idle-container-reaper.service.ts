export interface ContainerMeta {
  containerId: string;
  lastActiveTimestamp: number;
  isExecuting: boolean;
}

export class IdleContainerReaperService {
  public identifyOrphanedContainers(containers: ContainerMeta[], maxIdleMs: number = 300000, now: number = Date.now()): string[] {
    const orphaned: string[] = [];

    for (const c of containers) {
      if (!c.isExecuting && (now - c.lastActiveTimestamp > maxIdleMs)) {
        orphaned.push(c.containerId);
      }
    }

    return orphaned;
  }
}
