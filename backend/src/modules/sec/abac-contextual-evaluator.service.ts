export interface SubjectContext {
  userId: string;
  roles: string[];
  riskScore: number; // 0 (low) to 100 (high)
}

export class ABACContextualEvaluatorService {
  public evaluateAccess(subject: SubjectContext, action: string, maxAllowedRisk: number = 50): boolean {
    if (subject.riskScore > maxAllowedRisk) {
      return false; // High risk blocked
    }
    if (action === 'admin:delete' && !subject.roles.includes('ADMIN')) {
      return false;
    }
    return true;
  }
}
