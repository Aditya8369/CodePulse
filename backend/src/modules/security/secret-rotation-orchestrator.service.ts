import { Injectable } from '@nestjs/common';

export interface KeyVersion {
  version: number;
  secret: string;
  status: 'ACTIVE' | 'PREVIOUS' | 'REVOKED';
}

@Injectable()
export class SecretRotationOrchestratorService {
  private readonly keyVersions: KeyVersion[] = [
    { version: 1, secret: 'initial_secret_key_v1', status: 'ACTIVE' }
  ];

  public rotateSecret(newSecret: string): KeyVersion {
    // Demote current active to previous
    for (const k of this.keyVersions) {
      if (k.status === 'ACTIVE') k.status = 'PREVIOUS';
    }
    const newVersion: KeyVersion = {
      version: this.keyVersions.length + 1,
      secret: newSecret,
      status: 'ACTIVE',
    };
    this.keyVersions.push(newVersion);
    return newVersion;
  }

  public getValidSecrets(): string[] {
    return this.keyVersions.filter(k => k.status !== 'REVOKED').map(k => k.secret);
  }
}
