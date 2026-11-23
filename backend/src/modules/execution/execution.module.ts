import { Module } from '@nestjs/common';
import { SandboxIsolationService } from './sandbox-isolation.service';
import { WasmRuntimeService } from './wasm-runtime.service';
import { WasmRunnerService } from './wasm-runner.service';
import { JailerService } from './jailer.service';
import { ExecutionController } from './execution.controller';

@Module({
  controllers: [ExecutionController],
  providers: [
    SandboxIsolationService,
    WasmRuntimeService,
    WasmRunnerService,
    JailerService,
  ],
  exports: [
    SandboxIsolationService,
    WasmRuntimeService,
    WasmRunnerService,
    JailerService,
  ],
})
export class ExecutionModule {}
