import { Module } from '@nestjs/common';
import { ShadowCodingService } from './shadow-coding.service';
import { MentorshipController } from './mentorship.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MentorshipController],
  providers: [ShadowCodingService],
  exports: [ShadowCodingService],
})
export class MentorshipModule {}
