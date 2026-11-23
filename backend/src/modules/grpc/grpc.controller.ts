import { Controller, Get, Post, Body, Query, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GrpcStreamService, RunnerStreamMessageDto, ServerControlMessageDto } from './grpc.service';

@ApiTags('gRPC Gateway')
@Controller('grpc')
export class GrpcGatewayController {
  constructor(private readonly grpcService: GrpcStreamService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get gRPC streaming gateway runtime metrics' })
  getMetrics() {
    return this.grpcService.getMetrics();
  }

  @Post('heartbeat')
  @ApiOperation({ summary: 'Runner pod unary heartbeat endpoint' })
  heartbeat(@Body() body: { runnerId: string; status: string; activeJobs: number }) {
    return this.grpcService.recordHeartbeat(body.runnerId, body.status, body.activeJobs);
  }

  @Post('stream/message')
  @ApiOperation({ summary: 'Ingest runner execution stream message' })
  postMessage(@Body() msg: RunnerStreamMessageDto) {
    this.grpcService.processRunnerMessage(msg);
    return { status: 'RECEIVED', sequence: msg.sequence };
  }

  @Post('control')
  @ApiOperation({ summary: 'Dispatch control signal to runner pod' })
  sendControl(@Body() control: ServerControlMessageDto) {
    this.grpcService.sendControlSignal(control);
    return { status: 'DISPATCHED', action: control.action };
  }

  @Get('benchmark')
  @ApiOperation({ summary: 'Benchmark Protobuf vs JSON serialization latency and throughput' })
  getBenchmark(@Query('samples') samples?: string) {
    const count = samples ? parseInt(samples, 10) : 10000;
    return this.grpcService.benchmarkProtobufVsJson(count);
  }
}
