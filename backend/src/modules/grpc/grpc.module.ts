import { Module } from '@nestjs/common';
import { GrpcGatewayController } from './grpc.controller';
import { GrpcStreamService } from './grpc.service';

@Module({
  controllers: [GrpcGatewayController],
  providers: [GrpcStreamService],
  exports: [GrpcStreamService],
})
export class GrpcModule {}
