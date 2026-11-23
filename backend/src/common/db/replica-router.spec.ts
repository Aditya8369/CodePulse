import { PrismaClient } from '@prisma/client';
import { ReplicaRouter } from './replica-router';

describe('ReplicaRouter (Multi-Region Read Replica Router with Read-Your-Own-Writes)', () => {
  let router: ReplicaRouter;
  let mockPrimary: PrismaClient;
  let mockReplica: PrismaClient;

  beforeEach(() => {
    mockPrimary = {
      $queryRaw: vi.fn().mockResolvedValue([{ version: 'PostgreSQL Primary 16' }]),
    } as unknown as PrismaClient;

    mockReplica = {
      $queryRaw: vi.fn().mockResolvedValue([{ version: 'PostgreSQL Read Replica 16' }]),
    } as unknown as PrismaClient;

    router = new ReplicaRouter();
    router.setClients(mockPrimary, mockReplica);
  });

  afterEach(() => {
    router.onModuleDestroy();
  });

  it('routes write operations (isWrite: true) directly to the Primary DB', async () => {
    const client = await router.getClient({ isWrite: true, userId: 'user-bob' });
    expect(client).toBe(mockPrimary);
  });

  it('routes analytical read operations without recent write to Read Replica', async () => {
    const client = await router.getClient({ isWrite: false, userId: 'user-bob' });
    expect(client).toBe(mockReplica);
  });

  it('guarantees Read-Your-Own-Writes by routing reads to Primary during 5-second sticky window', async () => {
    const userId = 'player-alice';

    // Alice just finished a match and earned ELO (write recorded)
    await router.recordWrite(userId, '0/15A2C8');

    // Alice immediately views her profile
    const clientImmediately = await router.getClient({ isWrite: false, userId });
    expect(clientImmediately).toBe(mockPrimary);

    // Another user without writes still gets routed to replica
    const otherUserClient = await router.getClient({ isWrite: false, userId: 'user-charlie' });
    expect(otherUserClient).toBe(mockReplica);
  });

  it('fails over to Primary DB when Read Replica fails healthcheck', async () => {
    // Simulate replica failing queries
    (mockReplica.$queryRaw as any).mockRejectedValue(new Error('Connection terminated'));

    // Probe replica health twice to trigger failure threshold
    await router.probeReplicaHealth();
    await router.probeReplicaHealth();

    expect(router.getHealth().isHealthy).toBe(false);

    // Read queries now automatically fail over to Primary
    const client = await router.getClient({ isWrite: false, userId: 'user-david' });
    expect(client).toBe(mockPrimary);
  });
});
