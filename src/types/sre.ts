
export interface NodeAffinityRule {
  podType: 'compiler' | 'database' | 'api';
  disallowedNodeLabels: Record<string, string>;
  requiredNodeLabels?: Record<string, string>;
}

export interface AffinityEvaluation {
  allowed: boolean;
  reason?: string;
  targetNode: string;
}

export interface RumBeacon {
  page: string;
  lcpMs: number;
  fidMs: number;
  clsScore: number;
  ttfbMs: number;
  timestamp: number;
}

export interface CoreWebVitalsReport {
  sampleCount: number;
  p75LcpMs: number;
  p75FidMs: number;
  p75ClsScore: number;
  overallHealth: 'good' | 'needs_improvement' | 'poor';
}

export interface CgroupMemoryStatus {
  currentBytes: number;
  maxBytes: number;
  utilizationPercent: number;
  oomRisk: 'low' | 'moderate' | 'critical';
}

export interface MemoryTuningDecision {
  adjustedLimitBytes: number;
  headroomAddedBytes: number;
  actionTaken: 'expanded' | 'maintained';
}

export interface RateLimitMetrics {
  tenantId: string;
  requestCount: number;
  historicalMean: number;
  historicalStdDev: number;
}

export interface RateLimitAnomaly {
  isAnomaly: boolean;
  zScore: number;
  severity: 'normal' | 'suspicious' | 'critical';
}

export interface DirtyPageStats {
  dirtyBytes: number;
  totalMemoryBytes: number;
  dirtyRatioPercent: number;
}

export interface PageCacheGovernanceDecision {
  triggerSync: boolean;
  throttleWriteback: boolean;
  reason?: string;
}

export interface DeploymentGateStatus {
  schemaVersion: string;
  expectedVersion: string;
  replicasSynced: boolean;
  canShiftTraffic: boolean;
  reason?: string;
}

export interface SpanDependency {
  parentService: string;
  childService: string;
  latencyMs: number;
  hasError: boolean;
}

export interface TopologyGraph {
  nodes: string[];
  edges: { from: string; to: string; callCount: number }[];
  hasCircularDependency: boolean;
}

export interface TcpPoolStats {
  activeSockets: number;
  idleSockets: number;
  maxAgeMs: number;
}

export interface RecycleDecision {
  socketsToClose: number;
  reclaimedPorts: number;
}

export interface CertificateStatus {
  domain: string;
  expiresAt: number;
  issuer: string;
}

export interface RenewalEvaluation {
  needsRenewal: boolean;
  daysRemaining: number;
  triggerAcme: boolean;
}

export interface LogEvent {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: number;
}

export interface LogThrottleDecision {
  shouldLog: boolean;
  isThrottled: boolean;
  activeRate: number;
}

export interface NodeAffinityRule {
  podType: 'compiler' | 'database' | 'api';
  disallowedNodeLabels: Record<string, string>;
  requiredNodeLabels?: Record<string, string>;
}

export interface AffinityEvaluation {
  allowed: boolean;
  reason?: string;
  targetNode: string;
}

export interface RumBeacon {
  page: string;
  lcpMs: number;
  fidMs: number;
  clsScore: number;
  ttfbMs: number;
  timestamp: number;
}

export interface CoreWebVitalsReport {
  sampleCount: number;
  p75LcpMs: number;
  p75FidMs: number;
  p75ClsScore: number;
  overallHealth: 'good' | 'needs_improvement' | 'poor';
}

export interface CgroupMemoryStatus {
  currentBytes: number;
  maxBytes: number;
  utilizationPercent: number;
  oomRisk: 'low' | 'moderate' | 'critical';
}

export interface MemoryTuningDecision {
  adjustedLimitBytes: number;
  headroomAddedBytes: number;
  actionTaken: 'expanded' | 'maintained';
}

export interface RateLimitMetrics {
  tenantId: string;
  requestCount: number;
  historicalMean: number;
  historicalStdDev: number;
}

export interface RateLimitAnomaly {
  isAnomaly: boolean;
  zScore: number;
  severity: 'normal' | 'suspicious' | 'critical';
}

export interface DirtyPageStats {
  dirtyBytes: number;
  totalMemoryBytes: number;
  dirtyRatioPercent: number;
}

export interface PageCacheGovernanceDecision {
  triggerSync: boolean;
  throttleWriteback: boolean;
  reason?: string;
}

export interface DeploymentGateStatus {
  schemaVersion: string;
  expectedVersion: string;
  replicasSynced: boolean;
  canShiftTraffic: boolean;
  reason?: string;
}

export interface SpanDependency {
  parentService: string;
  childService: string;
  latencyMs: number;
  hasError: boolean;
}

export interface TopologyGraph {
  nodes: string[];
  edges: { from: string; to: string; callCount: number }[];
  hasCircularDependency: boolean;
}

export interface TcpPoolStats {
  activeSockets: number;
  idleSockets: number;
  maxAgeMs: number;
}

export interface RecycleDecision {
  socketsToClose: number;
  reclaimedPorts: number;
}

export interface CertificateStatus {
  domain: string;
  expiresAt: number;
  issuer: string;
}

export interface RenewalEvaluation {
  needsRenewal: boolean;
  daysRemaining: number;
  triggerAcme: boolean;
}

export interface LogEvent {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: number;
}

export interface LogThrottleDecision {
  shouldLog: boolean;
  isThrottled: boolean;
  activeRate: number;
}
