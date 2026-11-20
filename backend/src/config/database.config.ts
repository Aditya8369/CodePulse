export enum LoadBalancingPolicy {
  WEIGHTED_COST = 'WEIGHTED_COST',
  LEAST_CONNECTIONS = 'LEAST_CONNECTIONS',
  ROUND_ROBIN = 'ROUND_ROBIN',
}

export interface ReplicaConfig {
  id: string;
  name: string;
  url: string;
  weightCapacity: number;
}

export interface DatabaseClusterConfig {
  primaryUrl: string;
  replicas: ReplicaConfig[];
  maxReplicationLagMs: number;
  healthProbeIntervalMs: number;
  healthProbeTimeoutMs: number;
  balancingPolicy: LoadBalancingPolicy;
  slowQueryThresholdMs: number;
}

export const defaultDatabaseConfig: DatabaseClusterConfig = {
  primaryUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/codepulse_primary',
  replicas: [
    {
      id: 'replica-us-east',
      name: 'PostgreSQL Read Replica 1 (us-east)',
      url:
        process.env.DATABASE_REPLICA_URL_1 ||
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/codepulse_replica_1',
      weightCapacity: 100,
    },
    {
      id: 'replica-eu-west',
      name: 'PostgreSQL Read Replica 2 (eu-west)',
      url:
        process.env.DATABASE_REPLICA_URL_2 ||
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/codepulse_replica_2',
      weightCapacity: 100,
    },
    {
      id: 'replica-ap-south',
      name: 'PostgreSQL Read Replica 3 (ap-south)',
      url:
        process.env.DATABASE_REPLICA_URL_3 ||
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/codepulse_replica_3',
      weightCapacity: 100,
    },
  ],
  maxReplicationLagMs: parseInt(
    process.env.MAX_REPLICATION_LAG_MS || '500',
    10,
  ),
  healthProbeIntervalMs: 5000,
  healthProbeTimeoutMs: 2000,
  balancingPolicy:
    (process.env.LOAD_BALANCING_POLICY as LoadBalancingPolicy) ||
    LoadBalancingPolicy.WEIGHTED_COST,
  slowQueryThresholdMs: parseInt(
    process.env.SLOW_QUERY_THRESHOLD_MS || '200',
    10,
  ),
};
