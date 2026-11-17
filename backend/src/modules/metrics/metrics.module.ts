import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../../prisma/prisma.module';
import { QueuesModule } from '../queues/queues.module';
import { MetricsInterceptor } from '../../common/interceptors/metrics.interceptor';
import { MetricsBasicAuthGuard } from './metrics-basic-auth.guard';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [PrismaModule, QueuesModule],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    MetricsBasicAuthGuard,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
