export class MVCCOptimisticLockResolverService {
  public async executeWithRetry<T>(
    operation: (version: number) => Promise<{ success: boolean; data?: T; versionConflict?: boolean }>,
    initialVersion: number,
    maxRetries: number = 3
  ): Promise<{ success: boolean; data?: T; retriesAttempted: number }> {
    let currentVersion = initialVersion;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await operation(currentVersion);
      if (res.success) {
        return { success: true, data: res.data, retriesAttempted: attempt };
      }
      if (res.versionConflict) {
        currentVersion++; // Simulated version increment upon reload
      }
    }

    return { success: false, retriesAttempted: maxRetries };
  }
}
