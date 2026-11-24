export interface EgressRoutingDecision {
  destinationRegion: string;
  routeType: 'VPC_PEERING_TRANSIT_GATEWAY' | 'PUBLIC_INTERNET';
  targetEndpoint: string;
  estimatedCostPerGbUsd: number;
  savingsRatio: number;
}

export class EgressTrafficOptimizerService {
  private peeringRoutes = new Map<string, string>([
    ['us-east-1->us-west-2', 'tgw-peering-usw2.internal'],
    ['us-east-1->eu-west-1', 'tgw-peering-euw1.internal'],
    ['us-west-2->us-east-1', 'tgw-peering-use1.internal'],
    ['eu-west-1->us-east-1', 'tgw-peering-use1.internal']
  ]);

  public routeTransfer(
    sourceRegion: string,
    destRegion: string,
    publicEndpoint: string
  ): EgressRoutingDecision {
    const routeKey = `${sourceRegion}->${destRegion}`;

    if (sourceRegion === destRegion) {
      return {
        destinationRegion: destRegion,
        routeType: 'VPC_PEERING_TRANSIT_GATEWAY',
        targetEndpoint: `intra-region.${destRegion}.internal`,
        estimatedCostPerGbUsd: 0.01,
        savingsRatio: 0.89
      };
    }

    const privateGateway = this.peeringRoutes.get(routeKey);

    if (privateGateway) {
      return {
        destinationRegion: destRegion,
        routeType: 'VPC_PEERING_TRANSIT_GATEWAY',
        targetEndpoint: privateGateway,
        estimatedCostPerGbUsd: 0.04, // $0.04 vs $0.09 public internet
        savingsRatio: 0.55 // 55% reduction
      };
    }

    return {
      destinationRegion: destRegion,
      routeType: 'PUBLIC_INTERNET',
      targetEndpoint: publicEndpoint,
      estimatedCostPerGbUsd: 0.09,
      savingsRatio: 0
    };
  }
}
