import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DeadlockDetectorService } from '../common/monitoring/deadlock-detector.service';
import { ReplicaBalancerService } from './replica-balancer.service';
import { SecurityModule } from '../modules/security/security.module';

@Global()
@Module({
  imports: [SecurityModule],
  providers: [PrismaService, DeadlockDetectorService, ReplicaBalancerService],
  exports: [PrismaService, DeadlockDetectorService, ReplicaBalancerService],
})
export class PrismaModule {}
