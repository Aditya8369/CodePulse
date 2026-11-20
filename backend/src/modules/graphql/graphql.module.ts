import { Module } from '@nestjs/common';
import {
  GraphqlFederationController,
  GraphqlFederationGatewayService,
  GraphqlSubscriptionsGateway,
} from './federation-gateway';

@Module({
  controllers: [GraphqlFederationController],
  providers: [GraphqlFederationGatewayService, GraphqlSubscriptionsGateway],
  exports: [GraphqlFederationGatewayService],
})
export class GraphqlGatewayModule {}
