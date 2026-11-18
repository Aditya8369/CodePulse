import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ReplicaBalancerService } from './replica-balancer.service';
import { SecurityModule } from '../modules/security/security.module';

@Global()
@Module({
  imports: [SecurityModule],
  providers: [PrismaService, ReplicaBalancerService],
  exports: [PrismaService, ReplicaBalancerService],
})
export class PrismaModule {}
