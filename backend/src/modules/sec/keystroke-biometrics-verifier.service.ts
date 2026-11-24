export interface KeystrokeProfile {
  userId: string;
  meanFlightTimeMs: number;
  varianceThresholdMs: number;
}

export class KeystrokeBiometricsVerifierService {
  private profiles = new Map<string, KeystrokeProfile>();

  public registerProfile(profile: KeystrokeProfile): void {
    this.profiles.set(profile.userId, profile);
  }

  public verifyCadence(userId: string, flightTimesMs: number[]): { verified: boolean; diff: number } {
    const profile = this.profiles.get(userId);
    if (!profile || flightTimesMs.length === 0) {
      return { verified: true, diff: 0 }; // Default pass if no baseline exists
    }

    const avg = flightTimesMs.reduce((a, b) => a + b, 0) / flightTimesMs.length;
    const diff = Math.abs(avg - profile.meanFlightTimeMs);
    const verified = diff <= profile.varianceThresholdMs;

    return { verified, diff: Math.round(diff) };
  }
}
