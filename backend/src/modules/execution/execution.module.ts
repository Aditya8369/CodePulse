import { Module } from '@nestjs/common';
import { SandboxIsolationService } from './sandbox-isolation.service';
import { WasmRuntimeService } from './wasm-runtime.service';
import { WasmRunnerService } from './wasm-runner.service';
import { ExecutionController } from './execution.controller';
import { LlvmJitService } from './llvm-jit.service';

@Module({
  controllers: [ExecutionController],
  providers: [
    SandboxIsolationService,
    WasmRuntimeService,
    WasmRunnerService,
    LlvmJitService,
  ],
  exports: [
    SandboxIsolationService,
    WasmRuntimeService,
    WasmRunnerService,
    LlvmJitService,
  ],
})
export class ExecutionModule {}
