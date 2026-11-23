export interface PactHeaderMatcher {
  [key: string]: string;
}

export interface PactRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  query?: Record<string, string>;
  headers?: PactHeaderMatcher;
  body?: Record<string, unknown>;
}

export interface PactResponse {
  status: number;
  headers?: PactHeaderMatcher;
  body: Record<string, unknown>;
}

export interface PactInteraction {
  description: string;
  providerState?: string;
  request: PactRequest;
  response: PactResponse;
}

export interface PactContract {
  consumer: { name: string };
  provider: { name: string };
  interactions: PactInteraction[];
  metadata: {
    pactSpecification: { version: string };
    createdAt: string;
  };
}

export interface ContractVerificationResult {
  passed: boolean;
  totalInteractions: number;
  verifiedCount: number;
  failures: Array<{
    interaction: string;
    errors: string[];
  }>;
}
