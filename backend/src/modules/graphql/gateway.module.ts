import { Module } from '@nestjs/common';
import {
  GraphqlFederationController,
  GraphqlFederationGatewayService,
  GraphqlSubscriptionsGateway,
  EntityDataLoader,
  MAX_QUERY_DEPTH,
  MAX_QUERY_COMPLEXITY,
} from './federation-gateway';
import { UserResolver } from '../users/resolvers/user.resolver';
import { BattleResolver } from '../battles/resolvers/battle.resolver';
import { RepositoryResolver } from '../repositories/resolvers/repository.resolver';
import { BadgeResolver } from '../badges/resolvers/badge.resolver';

@Module({
  controllers: [GraphqlFederationController],
  providers: [
    GraphqlFederationGatewayService,
    GraphqlSubscriptionsGateway,
    UserResolver,
    BattleResolver,
    RepositoryResolver,
    BadgeResolver,
  ],
  exports: [
    GraphqlFederationGatewayService,
    GraphqlSubscriptionsGateway,
    UserResolver,
    BattleResolver,
    RepositoryResolver,
    BadgeResolver,
  ],
})
export class GatewayModule {}

export const GraphqlGatewayModule = GatewayModule;

export {
  GraphqlFederationController,
  GraphqlFederationGatewayService,
  GraphqlSubscriptionsGateway,
  EntityDataLoader,
  MAX_QUERY_DEPTH,
  MAX_QUERY_COMPLEXITY,
};
