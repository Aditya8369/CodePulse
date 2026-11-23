import { ShardedMatchmakingQueueService } from './sharded-queue.service';

describe('ShardedMatchmakingQueueService (Consistent Hashing & Anti-Starvation Queue)', () => {
  let service: ShardedMatchmakingQueueService;

  beforeEach(() => {
    service = new ShardedMatchmakingQueueService();
  });

  afterEach(() => {
    service.onModuleDestroy();
    service.clear();
  });

  it('distributes players across shards via 128 virtual nodes per shard', () => {
    const shardCounts: Record<string, number> = {};

    for (let i = 0; i < 500; i++) {
      const elo = 800 + i * 4;
      const { shardId } = service.enqueue(`user_${i}`, `User${i}`, elo, 'US-EAST');
      shardCounts[shardId] = (shardCounts[shardId] || 0) + 1;
    }

    // All 4 shards must receive balanced traffic
    const activeShards = Object.keys(shardCounts);
    expect(activeShards.length).toBe(4);
    activeShards.forEach((s) => {
      expect(shardCounts[s]).toBeGreaterThan(30);
    });
  });

  it('guarantees zero double-matched players under high-concurrency requests', () => {
    const totalPlayers = 1000;
    for (let i = 0; i < totalPlayers; i++) {
      // Clustered around common ELOs (1200-1400)
      const elo = 1200 + (i % 20) * 10;
      service.enqueue(`player_${i}`, `Player${i}`, elo, 'US-EAST');
    }

    const matches = service.processAllShards();

    const seenUsers = new Set<string>();
    let duplicates = 0;

    for (const match of matches) {
      if (seenUsers.has(match.player1.userId)) duplicates++;
      seenUsers.add(match.player1.userId);

      if (match.player2) {
        if (seenUsers.has(match.player2.userId)) duplicates++;
        seenUsers.add(match.player2.userId);
      }
    }

    // Acceptance criteria: exactly zero double-matched players
    expect(duplicates).toBe(0);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('anti-starvation bracket expansion pairs high-ELO players after waiting', () => {
    // High-ELO player (1800) joined earlier
    const p1 = service.enqueue('high_elo_1', 'Grandmaster', 1800, 'US-EAST');
    // Simulate 12 seconds wait time (bracket expands: 25 + 2*25 = 75 ELO)
    p1.ticket.joinedAt = Date.now() - 12000;

    // Opponent with 1740 ELO (60 diff) joins
    service.enqueue('high_elo_2', 'Master', 1740, 'US-EAST');

    const matches = service.findMatchesInShard(p1.shardId);
    expect(matches.length).toBe(1);
    expect(matches[0].eloDifference).toBe(60);
    expect(matches[0].isBotMatch).toBe(false);
  });

  it('triggers AI bot fallback when wait time reaches 30 seconds maximum cap', () => {
    const { ticket, shardId } = service.enqueue('lonely_player', 'LonelyUser', 2400, 'AP-SOUTH');
    // Simulate 31 seconds elapsed
    ticket.joinedAt = Date.now() - 31000;

    const matches = service.findMatchesInShard(shardId);

    expect(matches.length).toBe(1);
    expect(matches[0].isBotMatch).toBe(true);
    expect(matches[0].player1.userId).toBe('lonely_player');
    expect(matches[0].player2).toBeUndefined();
  });
});
