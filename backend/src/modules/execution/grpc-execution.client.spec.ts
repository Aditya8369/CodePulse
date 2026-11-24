import { Test, TestingModule } from '@nestjs/testing';
import { GrpcExecutionClient } from './grpc-execution.client';
import { ExecutionController } from './execution.controller';
import { WasmRuntimeService } from './wasm-runtime.service';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

describe('GrpcExecutionClient & High-Performance gRPC Communication Bridge (#375)', () => {
  let client: GrpcExecutionClient;
  let controller: ExecutionController;

  const mockWasmRuntimeService = {
    execute: jest.fn().mockResolvedValue({}),
    benchmarkColdStart: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExecutionController],
      providers: [
        {
          provide: GrpcExecutionClient,
          useFactory: () =>
            new GrpcExecutionClient({
              endpoints: ['localhost:50051', 'localhost:50052'],
              poolSizePerNode: 2,
              loadBalancingStrategy: 'ROUND_ROBIN',
            }),
        },
        { provide: WasmRuntimeService, useValue: mockWasmRuntimeService },
      ],
    }).compile();

    client = module.get<GrpcExecutionClient>(GrpcExecutionClient);
    controller = module.get<ExecutionController>(ExecutionController);
    await client.onModuleInit();
  });

  afterEach(() => {
    client.onModuleDestroy();
  });

  describe('1. Protocol Buffers Schema Compilation', () => {
    it('should compile proto/execution.proto cleanly with all message and service definitions', () => {
      const protoPath = path.resolve(process.cwd(), 'proto/execution.proto');
      const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });

      expect(packageDefinition['codepulse.execution.v1.CodeExecutionService']).toBeDefined();
      expect(packageDefinition['codepulse.execution.v1.ExecuteRequest']).toBeDefined();
      expect(packageDefinition['codepulse.execution.v1.ExecuteResponse']).toBeDefined();
      expect(packageDefinition['codepulse.execution.v1.ExecuteStatus']).toBeDefined();
      expect(packageDefinition['codepulse.execution.v1.ExecuteClientMessage']).toBeDefined();
      expect(packageDefinition['codepulse.execution.v1.HealthCheckRequest']).toBeDefined();
      expect(packageDefinition['codepulse.execution.v1.HealthCheckResponse']).toBeDefined();
    });
  });

  describe('2. Connection Pooling & HTTP/2 Channel Management', () => {
    it('should initialize connection pools across multiple runner nodes', () => {
      const nodes = client.getNodeClusterStatus();
      expect(nodes.length).toBe(2);
      expect(nodes[0].endpoint).toBe('localhost:50051');
      expect(nodes[1].endpoint).toBe('localhost:50052');
      expect(nodes[0].status).toBe('HEALTHY');
      expect(nodes[1].status).toBe('HEALTHY');
      expect(nodes[0].clientPool.length).toBe(2);
    });

    it('should distribute calls using round-robin load balancing', () => {
      const node1 = client.selectHealthyNode();
      const node2 = client.selectHealthyNode();
      const node3 = client.selectHealthyNode();

      expect(node1?.endpoint).toBe('localhost:50051');
      expect(node2?.endpoint).toBe('localhost:50052');
      expect(node3?.endpoint).toBe('localhost:50051');
    });
  });

  describe('3. Code Execution Lifecycle (Unary RPC)', () => {
    it('should execute code request and return response with execution metadata', async () => {
      const response = await client.execute({
        code: 'console.log("Hello, gRPC!");',
        language: 'typescript',
        timeout_ms: 2000,
        memory_limit_mb: 128,
      });

      expect(response).toBeDefined();
      expect(response.execution_id).toBeDefined();
      expect(response.status).toBe('SUCCESS');
      expect(response.exit_code).toBe(0);
      expect(response.runner_node_id).toBeDefined();
    });

    it('should handle infinite loops and timeout execution requests', async () => {
      const response = await client.execute({
        code: 'while (true) {}',
        language: 'typescript',
        timeout_ms: 500,
      });

      expect(response).toBeDefined();
      expect(response.status).toBe('TIMEOUT');
      expect(response.exit_code).toBe(124);
    });
  });

  describe('4. Real-Time Streaming & Incremental Progress', () => {
    it('should stream execution status updates via server streaming', async () => {
      const receivedStatuses: any[] = [];

      const finalResponse = await client.streamExecute(
        {
          code: 'function solve() { return 42; }',
          language: 'python',
        },
        (status) => {
          receivedStatuses.push(status);
        },
      );

      expect(receivedStatuses.length).toBeGreaterThanOrEqual(3);
      expect(receivedStatuses[0].step).toBe('QUEUED');
      expect(receivedStatuses[receivedStatuses.length - 1].step).toBe('COMPLETED');
      expect(finalResponse.status).toBe('SUCCESS');
    });

    it('should support bidirectional streaming for interactive execution chunks', () => {
      const chunks: any[] = [];
      const bidi = client.bidirectionalStream((status) => {
        chunks.push(status);
      });

      bidi.write({
        execution_id: 'bidi_test_1',
        initial_request: {
          code: 'print("streaming")',
          language: 'python',
        },
      });

      bidi.end();

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('5. Performance Benchmark: Protobuf vs JSON Overhead', () => {
    it('should demonstrate >= 40% reduction in CPU serialization overhead and >= 2x throughput', () => {
      const result = client.benchmarkSerialization(1000);

      expect(result.sampleCount).toBe(1000);
      expect(result.overheadReductionPercent).toBeGreaterThanOrEqual(40);
      expect(result.throughputMultiplier).toBeGreaterThanOrEqual(2.0);
      expect(result.protobufPayloadBytes).toBeLessThan(result.jsonPayloadBytes);
    });
  });

  describe('6. Controller REST Integration', () => {
    it('should dispatch execution via POST /api/execution/grpc/execute', async () => {
      const response = await controller.executeGrpc({
        code: 'let x = 10;',
        language: 'typescript',
      });

      expect(response).toBeDefined();
      expect(response.status).toBe('SUCCESS');
    });

    it('should query runner cluster nodes via GET /api/execution/grpc/nodes', () => {
      const nodes = controller.getGrpcNodesStatus();
      expect(nodes.length).toBe(2);
    });

    it('should run benchmark via GET /api/execution/grpc/benchmark', () => {
      const bench = controller.benchmarkGrpc('500');
      expect(bench.sampleCount).toBe(500);
      expect(bench.overheadReductionPercent).toBeGreaterThanOrEqual(40);
    });
  });
});

