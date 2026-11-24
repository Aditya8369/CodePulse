import { UnhandledRejectionGuardrailService, RequestContext } from './unhandled-rejection-guardrail.service';

describe('UnhandledRejectionGuardrailService', () => {
  let guardrail: UnhandledRejectionGuardrailService;

  beforeEach(() => {
    guardrail = new UnhandledRejectionGuardrailService();
  });

  afterEach(() => {
    guardrail.onModuleDestroy();
  });

  it('should capture rejection and correlate with active AsyncLocalStorage request context', () => {
    const context: RequestContext = {
      traceId: 'trace-abc-123',
      userId: 'user-77',
      route: '/api/v1/async-task',
      method: 'POST',
      timestamp: Date.now(),
    };

    guardrail.runWithContext(context, () => {
      const diag = guardrail.handleRejection(new Error('Background promise failed'));
      expect(diag.context).toBeDefined();
      expect(diag.context?.traceId).toBe('trace-abc-123');
      expect(diag.context?.userId).toBe('user-77');
      expect(diag.errorMessage).toBe('Background promise failed');
      expect(guardrail.getTrappedCount()).toBe(1);
    });
  });

  it('should handle non-Error rejection values gracefully', () => {
    const diag = guardrail.handleRejection('Raw string rejection reason');
    expect(diag.errorMessage).toBe('Raw string rejection reason');
    expect(diag.errorName).toBe('UnhandledRejection');
  });
});
