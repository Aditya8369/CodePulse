import { Injectable, Logger } from '@nestjs/common';

export interface VulnerabilityRecord {
  cveId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  package: string;
}

@Injectable()
export class ContainerPatchTriggerService {
  private readonly logger = new Logger(ContainerPatchTriggerService.name);

  public evaluateVulnerabilities(imageTag: string, cves: VulnerabilityRecord[]): { requiresPatch: boolean; rebuildTriggered: boolean } {
    const criticals = cves.filter((c) => c.severity === 'CRITICAL');
    if (criticals.length > 0) {
      this.logger.error(`Base image ${imageTag} has ${criticals.length} CRITICAL CVEs! Dispatching rebuild.`);
      return { requiresPatch: true, rebuildTriggered: true };
    }
    return { requiresPatch: false, rebuildTriggered: false };
  }
}
