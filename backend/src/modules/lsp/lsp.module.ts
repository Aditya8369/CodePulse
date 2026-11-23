import { Module } from '@nestjs/common';
import { LspDaemonService } from './lsp-daemon.service';

@Module({
  providers: [LspDaemonService],
  exports: [LspDaemonService],
})
export class LspModule {}
