import { Injectable } from '@nestjs/common';
import { RingBufferWriterService } from './ring-buffer-writer.service';

export type FastLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LEVEL_NUMBERS: Record<FastLogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

@Injectable()
export class ZeroAllocationLogger {
  private serviceName = 'codepulse-backend';
  private pid = process.pid;

  constructor(private readonly ringBufferWriter: RingBufferWriterService) {}

  public setServiceName(name: string): void {
    this.serviceName = name;
  }

  /**
   * High-speed structured log writer.
   * Avoids dynamic object allocations by assembling JSON string representations directly.
   */
  public log(
    level: FastLogLevel,
    msg: string,
    context?: string,
    data?: Record<string, string | number | boolean>,
  ): void {
    const timestamp = Date.now();
    const levelNum = LEVEL_NUMBERS[level];

    let extraJson = '';
    if (data) {
      const keys = Object.keys(data);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = data[k];
        extraJson += `,"${k}":${typeof v === 'string' ? `"${this.escapeString(v)}"` : v}`;
      }
    }

    const contextField = context ? `,"context":"${this.escapeString(context)}"` : '';

    // Assembled minimal JSON log line
    const jsonLine = `{"level":${levelNum},"time":${timestamp},"pid":${this.pid},"service":"${this.serviceName}","msg":"${this.escapeString(msg)}"${contextField}${extraJson}}`;

    this.ringBufferWriter.push(jsonLine);
  }

  public info(msg: string, context?: string, data?: Record<string, any>): void {
    this.log('info', msg, context, data);
  }

  public warn(msg: string, context?: string, data?: Record<string, any>): void {
    this.log('warn', msg, context, data);
  }

  public error(msg: string, context?: string, data?: Record<string, any>): void {
    this.log('error', msg, context, data);
  }

  public debug(msg: string, context?: string, data?: Record<string, any>): void {
    this.log('debug', msg, context, data);
  }

  /**
   * Fast benchmark to verify throughput capability.
   */
  public benchmark(iterations = 10000): { durationMs: number; throughputPerSec: number } {
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      this.log('info', 'Benchmark test message', 'BenchmarkSuite', { iteration: i });
    }
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    const throughputPerSec = Math.round((iterations / durationMs) * 1000);

    return { durationMs, throughputPerSec };
  }

  private escapeString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  }
}
