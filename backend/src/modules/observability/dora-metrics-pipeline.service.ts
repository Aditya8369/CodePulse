export interface IncidentEvent {
  incidentId: string;
  startedAt: number;
  resolvedAt: number;
}

export class DORAMetricsPipelineService {
  public computeMTTR(incidents: IncidentEvent[]): number {
    if (incidents.length === 0) return 0;
    const totalDurationMs = incidents.reduce((sum, inc) => sum + (inc.resolvedAt - inc.startedAt), 0);
    return Math.floor(totalDurationMs / incidents.length / 1000 / 60); // In minutes
  }

  public computeDeploymentFrequency(deploymentsCount: number, days: number): number {
    if (days <= 0) return 0;
    return Number((deploymentsCount / days).toFixed(2));
  }
}
