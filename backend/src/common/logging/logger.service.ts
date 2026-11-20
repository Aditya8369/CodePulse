import { Injectable, LoggerService as INestLogger } from '@nestjs/common';
import { PiiRedactorService } from './pii-redactor.service';

export type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

export interface FormattedLogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  timestamp: string;
  metadata?: unknown;
  sanitized: boolean;
}

@Injectable()
export class LoggerService implements INestLogger {
  private static instance: LoggerService;

  constructor(private readonly piiRedactor: PiiRedactorService) {
    LoggerService.instance = this;
  }

  public static getInstance(): LoggerService | undefined {
    return LoggerService.instance;
  }

  log(message: any, ...optionalParams: any[]) {
    this.printLog('log', message, optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.printLog('error', message, optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.printLog('warn', message, optionalParams);
  }

  debug?(message: any, ...optionalParams: any[]) {
    this.printLog('debug', message, optionalParams);
  }

  verbose?(message: any, ...optionalParams: any[]) {
    this.printLog('verbose', message, optionalParams);
  }

  /**
   * Internal pipeline: redacts PII and tokens before printing to output stream (console/Winston/Pino)
   */
  public formatLog(
    level: LogLevel,
    message: any,
    optionalParams: any[],
  ): FormattedLogEntry {
    const timestamp = new Date().toISOString();
    let context: string | undefined;
    let metadata: unknown;

    if (optionalParams.length > 0) {
      const lastParam = optionalParams[optionalParams.length - 1];
      if (typeof lastParam === 'string' && optionalParams.length === 1) {
        context = lastParam;
      } else {
        metadata = this.piiRedactor.redactObject(optionalParams);
      }
    }

    let sanitizedMessage: string;
    if (typeof message === 'string') {
      sanitizedMessage = this.piiRedactor.redactString(message).redactedText;
    } else if (typeof message === 'object') {
      sanitizedMessage = JSON.stringify(this.piiRedactor.redactObject(message));
    } else {
      sanitizedMessage = String(message);
    }

    return {
      level,
      message: sanitizedMessage,
      context,
      timestamp,
      metadata,
      sanitized: true,
    };
  }

  private printLog(level: LogLevel, message: any, optionalParams: any[]) {
    const entry = this.formatLog(level, message, optionalParams);
    const prefix = `[CodePulse] ${entry.timestamp} [${entry.level.toUpperCase()}]${
      entry.context ? ` [${entry.context}]` : ''
    }`;

    const output = `${prefix} ${entry.message}`;

    switch (level) {
      case 'error':
        console.error(output, entry.metadata ?? '');
        break;
      case 'warn':
        console.warn(output, entry.metadata ?? '');
        break;
      case 'debug':
      case 'verbose':
        console.debug(output, entry.metadata ?? '');
        break;
      case 'log':
      default:
        console.log(output, entry.metadata ?? '');
        break;
    }
  }
}
