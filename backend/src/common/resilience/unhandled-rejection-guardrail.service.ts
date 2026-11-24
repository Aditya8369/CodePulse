import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  traceId: string;
  userId?: string;
  route?: string;
  method?: string;
  timestamp: number;
}

export interface RejectionDiagnostic {
  id: string;
  timestamp: Date;
  errorName: string;
  errorMessage: string;
  stackTrace?: string;
  context?: RequestContext;
  isFatal: boolean;
}

@Injectable()
export class UnhandledRejectionGuardrailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UnhandledRejectionGuardrailService.name);

  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();
  private readonly diagnostics: RejectionDiagnostic[] = [];
  private readonly MAX_DIAGNOSTICS = 500;

  private unhandledRejectionHandler?: (reason: any, promise: Promise<any>) => void;
  private uncaughtExceptionHandler?: (error: Error) => void;

  onModuleInit() {
    this.registerGlobalHandlers();
  }

  onModuleDestroy() {
    this.unregisterGlobalHandlers();
  }

  public getStorage(): AsyncLocalStorage<RequestContext> {
    return this.asyncLocalStorage;
  }

  /**
   * Runs an operation with request-scoped trace context.
   */
  public runWithContext<T>(context: RequestContext, fn: () => T): T {
    return this.asyncLocalStorage.run(context, fn);
  }

  public registerGlobalHandlers(): void {
    if (this.unhandledRejectionHandler) return;

    this.unhandledRejectionHandler = (reason: any) => {
      this.handleRejection(reason, false);
    };

    this.uncaughtExceptionHandler = (error: Error) => {
      this.handleRejection(error, true);
    };

    process.on('unhandledRejection', this.unhandledRejectionHandler);
    process.on('uncaughtException', this.uncaughtExceptionHandler);
    this.logger.log('Global Unhandled Rejection Guardrail registered');
  }

  public unregisterGlobalHandlers(): void {
    if (this.unhandledRejectionHandler) {
      process.off('unhandledRejection', this.unhandledRejectionHandler);
      this.unhandledRejectionHandler = undefined;
    }
    if (this.uncaughtExceptionHandler) {
      process.off('uncaughtException', this.uncaughtExceptionHandler);
      this.uncaughtExceptionHandler = undefined;
    }
  }

  /**
   * Formats structured diagnostic logs and isolates error to active context.
   */
  public handleRejection(error: any, isFatal = false): RejectionDiagnostic {
    const context = this.asyncLocalStorage.getStore();
    const id = `rej-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const errorName = error?.name || (error instanceof Error ? error.constructor.name : 'UnhandledRejection');
    const errorMessage = error?.message || String(error);
    const stackTrace = error?.stack;

    const diagnostic: RejectionDiagnostic = {
      id,
      timestamp: new Date(),
      errorName,
      errorMessage,
      stackTrace,
      context: context ? { ...context } : undefined,
      isFatal,
    };

    this.diagnostics.push(diagnostic);
    if (this.diagnostics.length > this.MAX_DIAGNOSTICS) {
      this.diagnostics.shift();
    }

    const contextStr = context ? `[traceId=${context.traceId}, route=${context.route || 'unknown'}]` : '[global context]';
    this.logger.error(`Unhandled Promise Rejection trapped ${contextStr}: ${errorName} - ${errorMessage}`);

    return diagnostic;
  }

  public getDiagnostics(): RejectionDiagnostic[] {
    return [...this.diagnostics];
  }

  public getTrappedCount(): number {
    return this.diagnostics.length;
  }
}
