export class MatchDisputeAdjudicatorService {
  public adjudicate(clientClaim: string, serverSnapshot: string, validatorHash: string): {
    upheld: boolean;
    reason?: string;
  } {
    if (clientClaim !== serverSnapshot) {
      return { upheld: false, reason: 'Client claim conflicts with authoritative server snapshot' };
    }
    if (serverSnapshot !== validatorHash) {
      return { upheld: false, reason: 'Server snapshot conflicts with independent validator ledger' };
    }
    return { upheld: true };
  }
}
