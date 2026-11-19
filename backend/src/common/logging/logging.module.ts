import { Global, Module } from '@nestjs/common';
import { PiiRedactorService } from './pii-redactor.service';
import { LoggerService } from './logger.service';
import { SanitizeLoggingInterceptor } from '../interceptors/sanitize-logging.interceptor';

@Global()
@Module({
  providers: [
    PiiRedactorService,
    LoggerService,
    SanitizeLoggingInterceptor,
  ],
  exports: [
    PiiRedactorService,
    LoggerService,
    SanitizeLoggingInterceptor,
  ],
})
export class LoggingModule {}
