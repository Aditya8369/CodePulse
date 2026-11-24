import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CostAllocationTagAuditorService {
  private readonly logger = new Logger(CostAllocationTagAuditorService.name);
  private requiredTags = ['Environment', 'CostCenter', 'Owner'];

  public auditResourceTags(resourceId: string, tags: Record<string, string>): { compliant: boolean; missingTags: string[] } {
    const missing: string[] = [];

    for (const req of this.requiredTags) {
      if (!tags[req] || tags[req].trim().length === 0) {
        missing.push(req);
      }
    }

    const compliant = missing.length === 0;
    if (!compliant) {
      this.logger.warn(`Resource ${resourceId} non-compliant with FinOps tags: missing ${missing.join(', ')}`);
    }

    return { compliant, missingTags: missing };
  }
}
