export class SSLRenewalWatchtowerService {
  public checkCertificateExpiry(validTo: Date, renewalThresholdDays: number = 30): {
    needsRenewal: boolean;
    daysRemaining: number;
  } {
    const msRemaining = validTo.getTime() - Date.now();
    const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));

    return {
      needsRenewal: daysRemaining <= renewalThresholdDays,
      daysRemaining
    };
  }
}
