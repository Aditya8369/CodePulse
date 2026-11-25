/**
 * Architecture Service 63: Distributed Pipeline Step Execution Timeout Supervisor
 * Subsystem: Graceful Cancellation
 */

export class PipelineStepTimeoutSupervisorService {
  public async executeWithTimeout<T>(
    stepName: string,
    action: (signal: { aborted: boolean }) => Promise<T>,
    timeoutMs: number
  ): Promise<{ success: boolean; result?: T; timedOut: boolean }> {
    const signal = { aborted: false };

    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<{ success: false; timedOut: true }>(resolve => {
      timer = setTimeout(() => {
        signal.aborted = true;
        resolve({ success: false, timedOut: true });
      }, timeoutMs);
    });

    try {
      const outcome = await Promise.race([
        action(signal).then(res => ({ success: true as const, result: res, timedOut: false as const })),
        timeoutPromise,
      ]);
      clearTimeout(timer!);
      return outcome;
    } catch {
      clearTimeout(timer!);
      return { success: false, timedOut: false };
    }
  }
}
