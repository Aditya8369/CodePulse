export class IPPenaltyBoxTarpitService {
  private offenses = new Map<string, number>();

  public recordViolation(ip: string): number {
    const current = this.offenses.get(ip) || 0;
    const next = current + 1;
    this.offenses.set(ip, next);
    return next;
  }

  public calculateTarpitDelayMs(ip: string): number {
    const count = this.offenses.get(ip) || 0;
    if (count === 0) return 0;
    // Exponential delay up to 10 seconds
    return Math.min(10000, 200 * Math.pow(2, count));
  }
}
