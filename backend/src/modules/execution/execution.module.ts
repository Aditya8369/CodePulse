import { Module } from '@nestjs/common';
import { SandboxIsolationService } from './sandbox-isolation.service';
import { WasmRuntimeService } from './wasm-runtime.service';
import { ExecutionController } from './execution.controller';

@Module({
  controllers: [ExecutionController],
  providers: [SandboxIsolationService, WasmRuntimeService],
  exports: [SandboxIsolationService, WasmRuntimeService],
})
export class ExecutionModule {}

