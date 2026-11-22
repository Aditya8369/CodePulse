import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrivacyService } from './privacy.service';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, PrivacyService, RedisService],
  exports: [UsersService, PrivacyService],
})
export class UsersModule {}
