export class NetworkEgressAnalyzerService {
  private egressMap = new Map<string, number>();

  public recordEgress(sourceRegion: string, targetRegion: string, bytes: number): void {
    const key = `${sourceRegion}->${targetRegion}`;
    const cur = this.egressMap.get(key) || 0;
    this.egressMap.set(key, cur + bytes);
  }

  public isSpiking(sourceRegion: string, targetRegion: string, thresholdBytes: number): boolean {
    const key = `${sourceRegion}->${targetRegion}`;
    const total = this.egressMap.get(key) || 0;
    return total > thresholdBytes;
  }
}
