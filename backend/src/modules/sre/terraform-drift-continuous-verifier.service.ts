import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TerraformDriftContinuousVerifierService {
  private readonly logger = new Logger(TerraformDriftContinuousVerifierService.name);

  public verifyDrift(declaredState: Record<string, string>, liveState: Record<string, string>): { hasDrift: boolean; driftedKeys: string[] } {
    const driftedKeys: string[] = [];
    for (const [key, val] of Object.entries(declaredState)) {
      if (liveState[key] !== val) {
        driftedKeys.push(key);
      }
    }
    const hasDrift = driftedKeys.length > 0;
    if (hasDrift) {
      this.logger.warn(`Terraform state drift detected on resources: ${driftedKeys.join(', ')}`);
    }
    return { hasDrift, driftedKeys };
  }
}
