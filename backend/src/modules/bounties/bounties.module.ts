import { Module } from '@nestjs/common';
import { BountiesService } from './bounties.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BountiesService],
  exports: [BountiesService],
})
export class BountiesModule {}
