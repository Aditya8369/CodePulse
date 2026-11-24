export type ShutdownHook = () => Promise<void>;

export class GracefulShutdownCoordinatorService {
  private hooks: { name: string; priority: number; hook: ShutdownHook }[] = [];
  private isShuttingDown: boolean = false;

  public registerHook(name: string, priority: number, hook: ShutdownHook): void {
    this.hooks.push({ name, priority, hook });
    this.hooks.sort((a, b) => b.priority - a.priority); // Highest priority executed first
  }

  public async initiateShutdown(timeoutMs: number = 10000): Promise<{ completed: string[]; timedOut: boolean }> {
    this.isShuttingDown = true;
    const completed: string[] = [];
    let timedOut = false;

    const timer = setTimeout(() => { timedOut = true; }, timeoutMs);

    for (const h of this.hooks) {
      if (timedOut) break;
      try {
        await h.hook();
        completed.push(h.name);
      } catch (err) {
        console.error(`Shutdown hook ${h.name} failed:`, err);
      }
    }

    clearTimeout(timer);
    return { completed, timedOut };
  }

  public isTerminating(): boolean {
    return this.isShuttingDown;
  }
}
