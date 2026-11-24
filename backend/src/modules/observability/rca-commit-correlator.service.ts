export interface DeploymentRecord {
  commitSha: string;
  deployedAt: number;
  author: string;
}

export class RCACommitCorrelatorService {
  public findSuspectDeployments(deployments: DeploymentRecord[], errorSpikeTimestamp: number, lookbackWindowMs: number = 1800000): DeploymentRecord[] {
    return deployments.filter(d =>
      d.deployedAt <= errorSpikeTimestamp &&
      errorSpikeTimestamp - d.deployedAt <= lookbackWindowMs
    );
  }
}
