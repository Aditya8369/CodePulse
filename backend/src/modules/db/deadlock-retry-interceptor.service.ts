export class DeadlockRetryInterceptorService {
  public async executeWithDeadlockRetry<T>(
    action: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<{ success: boolean; data?: T; retries: number }> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await action();
        return { success: true, data: result, retries: attempt };
      } catch (err: any) {
        const isDeadlock = err?.code === '40P01' || err?.message?.includes('deadlock detected');
        if (!isDeadlock || attempt === maxRetries - 1) {
          throw err;
        }
      }
    }
    return { success: false, retries: maxRetries };
  }
}
