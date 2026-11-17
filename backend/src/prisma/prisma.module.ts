import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DeadlockDetectorService } from '../common/monitoring/deadlock-detector.service';

@Global()
@Module({
  providers: [PrismaService, DeadlockDetectorService],
  exports: [PrismaService, DeadlockDetectorService],
})
export class PrismaModule {}
