export interface CrashDiagnostic {
  timestamp: string;
  type: 'UNCAUGHT_EXCEPTION' | 'UNHANDLED_REJECTION';
  message: string;
  stack?: string;
  memoryUsage: NodeJS.MemoryUsage;
}

export class GlobalCrashVaultService {
  private crashLogs: CrashDiagnostic[] = [];

  public captureCrash(type: 'UNCAUGHT_EXCEPTION' | 'UNHANDLED_REJECTION', error: Error | any): CrashDiagnostic {
    const diagnostic: CrashDiagnostic = {
      timestamp: new Date().toISOString(),
      type,
      message: error?.message || String(error),
      stack: error?.stack,
      memoryUsage: process.memoryUsage()
    };

    this.crashLogs.push(diagnostic);
    return diagnostic;
  }

  public getRecentDiagnostics(): CrashDiagnostic[] {
    return [...this.crashLogs];
  }
}
