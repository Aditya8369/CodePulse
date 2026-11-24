import { Module } from '@nestjs/common';
import { SandboxIsolationService } from './sandbox-isolation.service';
import { WasmRuntimeService } from './wasm-runtime.service';
import { WasmRunnerService } from './wasm-runner.service';
import { JailerService } from './jailer.service';
import { ExecutionController } from './execution.controller';
import { SandboxIpcController } from './sandbox-ipc.controller';
import { LlvmJitService } from './llvm-jit.service';
import { ZeroCopyIpcService } from '../../common/concurrency/zero-copy-ipc.service';
import { GrpcExecutionClient } from './grpc-execution.client';

@Module({
  controllers: [ExecutionController, SandboxIpcController],
  providers: [
    SandboxIsolationService,
    WasmRuntimeService,
    WasmRunnerService,
    JailerService,
    ZeroCopyIpcService,
    LlvmJitService,
    GrpcExecutionClient,
  ],
  exports: [
    SandboxIsolationService,
    WasmRuntimeService,
    WasmRunnerService,
    JailerService,
    ZeroCopyIpcService,
    LlvmJitService,
    GrpcExecutionClient,
  ],
})
export class ExecutionModule {}
