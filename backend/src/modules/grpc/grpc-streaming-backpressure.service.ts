export class GRPCStreamingBackpressureService {
  private availableCredits: number;
  private maxCreditWindow: number;

  constructor(initialCredits: number = 64) {
    this.availableCredits = initialCredits;
    this.maxCreditWindow = initialCredits;
  }

  public canTransmit(): boolean {
    return this.availableCredits > 0;
  }

  public consumeCredit(): boolean {
    if (this.availableCredits > 0) {
      this.availableCredits--;
      return true;
    }
    return false;
  }

  public replenishCredits(count: number): number {
    this.availableCredits = Math.min(this.maxCreditWindow, this.availableCredits + count);
    return this.availableCredits;
  }

  public getCredits(): number {
    return this.availableCredits;
  }
}
