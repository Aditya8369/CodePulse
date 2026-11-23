import { Global, Module } from '@nestjs/common';
import { PiiRedactorService } from './pii-redactor.service';
import { LoggerService } from './logger.service';
import { SanitizeLoggingInterceptor } from '../interceptors/sanitize-logging.interceptor';
import { ClickHouseLoggerService } from './clickhouse-logger.service';

@Global()
@Module({
  providers: [
    PiiRedactorService,
    LoggerService,
    SanitizeLoggingInterceptor,
    ClickHouseLoggerService,
  ],
  exports: [
    PiiRedactorService,
    LoggerService,
    SanitizeLoggingInterceptor,
    ClickHouseLoggerService,
  ],
})
export class LoggingModule {}
