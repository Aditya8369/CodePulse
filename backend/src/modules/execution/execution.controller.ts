import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { WasmRuntimeService } from './wasm-runtime.service';
import { WasmExecuteDto, WasmExecutionResult } from './dto/wasm-execute.dto';
import {
  GrpcExecutionClient,
  ExecuteRequest,
  ExecuteResponse,
  BenchmarkResult,
} from './grpc-execution.client';

@Controller('api/execution')
export class ExecutionController {
  constructor(
    private readonly wasmRuntimeService: WasmRuntimeService,
    @Optional() private readonly grpcExecutionClient?: GrpcExecutionClient,
  ) {}

  /**
   * Executes user algorithmic solutions in a secure WebAssembly sandbox
   * Features:
   * - Sub-5ms startup cold starts
   * - Strict fuel instruction counting to abort infinite loops
   * - Isolated WebAssembly.Memory with zero host memory access
   * - Safe WASI polyfills for stdin, stdout, and stderr
   */
  @Post('wasm/run')
  @Post('run-wasm')
  @HttpCode(HttpStatus.OK)
  async executeWasm(@Body() dto: WasmExecuteDto): Promise<WasmExecutionResult> {
    return this.wasmRuntimeService.execute(dto);
  }

  /**
   * Cold-start execution benchmark
   * Verifies that WebAssembly module startup and cold-starts meet the sub-5ms requirement
   */
  @Get('wasm/benchmark')
  @Get('benchmark-wasm')
  async benchmarkColdStart(
    @Query('samples') samples?: string,
  ): Promise<{
    averageStartupTimeMs: number;
    samples: number;
    sub5msMet: boolean;
    latencies: number[];
  }> {
    const numSamples = samples ? parseInt(samples, 10) : 20;
    return this.wasmRuntimeService.benchmarkColdStart(isNaN(numSamples) ? 20 : numSamples);
  }

  /**
   * Returns WebAssembly runtime sandbox health and engine specs
   */
  @Get('wasm/health')
  getSandboxHealth(): {
    status: string;
    engine: string;
    wasiSupported: boolean;
    maxFuelLimit: number;
    maxMemoryPages: number;
  } {
    return {
      status: 'ready',
      engine: 'V8-WebAssembly / Wasmtime Polyfill Sandbox',
      wasiSupported: true,
      maxFuelLimit: 1_000_000_000,
      maxMemoryPages: 256, // 16MB
    };
  }

  /**
   * Dispatches code execution to the gRPC microservice cluster with HTTP/2 multiplexing.
   */
  @Post('grpc/execute')
  @HttpCode(HttpStatus.OK)
  async executeGrpc(@Body() request: ExecuteRequest): Promise<ExecuteResponse> {
    if (!this.grpcExecutionClient) {
      throw new Error('GrpcExecutionClient is not initialized');
    }
    return this.grpcExecutionClient.execute(request);
  }

  /**
   * Retrieves active gRPC runner nodes cluster health and connection pool status.
   */
  @Get('grpc/nodes')
  getGrpcNodesStatus() {
    if (!this.grpcExecutionClient) {
      return [];
    }
    return this.grpcExecutionClient.getNodeClusterStatus();
  }

  /**
   * Benchmarks Protocol Buffers vs REST JSON serialization overhead.
   * Demonstrates >= 40% reduction in CPU serialization latency and >= 2x throughput.
   */
  @Get('grpc/benchmark')
  benchmarkGrpc(
    @Query('samples') samples?: string,
  ): BenchmarkResult {
    if (!this.grpcExecutionClient) {
      throw new Error('GrpcExecutionClient is not initialized');
    }
    const count = samples ? parseInt(samples, 10) : 1000;
    return this.grpcExecutionClient.benchmarkSerialization(isNaN(count) ? 1000 : count);
  }
}


