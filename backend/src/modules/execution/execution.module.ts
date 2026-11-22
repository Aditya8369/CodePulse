import { Module } from '@nestjs/common';
import { SandboxIsolationService } from './sandbox-isolation.service';
import { WasmRuntimeService } from './wasm-runtime.service';
import { JailerService } from './jailer.service';
import { ExecutionController } from './execution.controller';

@Module({
  controllers: [ExecutionController],
  providers: [SandboxIsolationService, WasmRuntimeService, JailerService],
  exports: [SandboxIsolationService, WasmRuntimeService, JailerService],
})
export class ExecutionModule {}

