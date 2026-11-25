/**
 * Architecture Service 24: Graceful Microservice Teardown Manager
 * Subsystem: Active Request Draining
 */

export class GracefulTeardownManagerService {
  private isDraining = false;
  private activeRequests = 0;
  private drainResolvers: Array<() => void> = [];

  public beginRequest(): boolean {
    if (this.isDraining) {
      return false; // Reject incoming traffic when shutting down
    }
    this.activeRequests++;
    return true;
  }

  public endRequest(): void {
    if (this.activeRequests > 0) {
      this.activeRequests--;
    }
    if (this.isDraining && this.activeRequests === 0) {
      for (const resolve of this.drainResolvers) {
        resolve();
      }
      this.drainResolvers = [];
    }
  }

  public initiateTeardown(): Promise<void> {
    this.isDraining = true;
    if (this.activeRequests === 0) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      this.drainResolvers.push(resolve);
    });
  }

  public get status(): { isDraining: boolean; activeRequests: number } {
    return {
      isDraining: this.isDraining,
      activeRequests: this.activeRequests,
    };
  }
}
