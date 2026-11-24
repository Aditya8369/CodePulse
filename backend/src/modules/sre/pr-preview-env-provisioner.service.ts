import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PrPreviewEnvProvisionerService {
  private readonly logger = new Logger(PrPreviewEnvProvisionerService.name);
  private readonly activeEnvironments = new Map<number, string>();

  public provisionEnvironment(prNumber: number): string {
    const namespace = `preview-pr-${prNumber}`;
    this.activeEnvironments.set(prNumber, namespace);
    this.logger.log(`Provisioned ephemeral preview environment for PR #${prNumber} (${namespace})`);
    return namespace;
  }

  public destroyEnvironment(prNumber: number): boolean {
    const exists = this.activeEnvironments.delete(prNumber);
    if (exists) {
      this.logger.log(`Tore down ephemeral preview environment for PR #${prNumber}`);
    }
    return exists;
  }
}
