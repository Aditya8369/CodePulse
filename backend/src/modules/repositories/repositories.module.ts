import { Module } from '@nestjs/common';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';
import { ArchiveStreamService } from './archive-stream.service';
import { ZeroCopyStreamService } from './zero-copy-stream.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RepositoriesController],
  providers: [
    RepositoriesService,
    ArchiveStreamService,
    ZeroCopyStreamService,
  ],
  exports: [
    RepositoriesService,
    ArchiveStreamService,
    ZeroCopyStreamService,
  ],
})
export class RepositoriesModule {}
