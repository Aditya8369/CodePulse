import { Injectable } from '@nestjs/common';

@Injectable()
export class EphemeralPostgresSandboxService {
  private readonly activeSandboxes = new Set<string>();

  public createSandboxSchema(testId: string): string {
    const schemaName = `test_sandbox_${testId.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    this.activeSandboxes.add(schemaName);
    return schemaName;
  }

  public dropSandboxSchema(schemaName: string): boolean {
    return this.activeSandboxes.delete(schemaName);
  }

  public getActiveSandboxCount(): number {
    return this.activeSandboxes.size;
  }
}
