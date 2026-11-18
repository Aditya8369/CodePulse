import { Module } from '@nestjs/common';
import { SandboxIsolationService } from './sandbox-isolation.service';

@Module({
  providers: [SandboxIsolationService],
  exports: [SandboxIsolationService],
})
export class ExecutionModule {}
