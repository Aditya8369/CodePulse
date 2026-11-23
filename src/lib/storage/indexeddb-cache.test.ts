import {
  IndexedDBCache,
  offlineCache,
  OfflineMutation,
} from './indexeddb-cache';

describe('IndexedDBCache & Conflict-Free Mutation Queue', () => {
  let cache: IndexedDBCache;

  beforeEach(() => {
    cache = new IndexedDBCache();
  });

  describe('Code Drafts Persistence (Last-Write-Wins)', () => {
    it('persists and retrieves code drafts with version incrementing', async () => {
      await cache.saveDraft('problem-binary-search', 'function search() { return -1; }', 'typescript');
      const draft = await cache.getDraft('problem-binary-search');

      expect(draft).not.toBeNull();
      expect(draft?.problemId).toBe('problem-binary-search');
      expect(draft?.code).toContain('function search');
      expect(draft?.language).toBe('typescript');
      expect(draft?.version).toBeGreaterThanOrEqual(1);
    });

    it('reconciles newer updates over older drafts without race conditions', async () => {
      await cache.saveDraft('prob-101', 'const v1 = 1;');
      const d1 = await cache.getDraft('prob-101');

      await cache.saveDraft('prob-101', 'const v2 = 2;');
      const d2 = await cache.getDraft('prob-101');

      expect(d2?.code).toBe('const v2 = 2;');
      expect(d2!.updatedAt).toBeGreaterThanOrEqual(d1!.updatedAt);
    });
  });

  describe('Mutation Queue & Idempotency', () => {
    it('enqueues mutations with status PENDING and idempotency key', async () => {
      const mutation = await cache.enqueueMutation('SUBMIT_SOLUTION', {
        problemId: 'prob-two-sum',
        battleId: 'battle-xyz',
        code: 'return [0, 1];',
        language: 'javascript',
        clientTimestamp: Date.now(),
      });

      expect(mutation.id).toBeDefined();
      expect(mutation.status).toBe('PENDING');
      expect(mutation.retryCount).toBe(0);

      const pending = await cache.getPendingMutations();
      expect(pending.some((m) => m.id === mutation.id)).toBe(true);
    });

    it('updates mutation status through lifecycle PENDING -> SYNCING -> COMPLETED', async () => {
      const mut = await cache.enqueueMutation('SUBMIT_SOLUTION', {
        problemId: 'prob-dfs',
        code: 'dfs()',
        language: 'python',
        clientTimestamp: Date.now(),
      });

      await cache.updateMutationStatus(mut.id, 'SYNCING');
      let pending = await cache.getPendingMutations();
      // SYNCING is in flight
      expect(pending.some((m) => m.id === mut.id)).toBe(false);

      await cache.updateMutationStatus(mut.id, 'COMPLETED');
      await cache.clearCompletedMutations();

      pending = await cache.getPendingMutations();
      expect(pending.some((m) => m.id === mut.id)).toBe(false);
    });

    it('tracks retry count and error messages upon failure', async () => {
      const mut = await cache.enqueueMutation('SUBMIT_SOLUTION', {
        problemId: 'prob-dp',
        code: 'dp()',
        language: 'cpp',
        clientTimestamp: Date.now(),
      });

      await cache.updateMutationStatus(mut.id, 'FAILED', 'HTTP 503 Server Unavailable');
      const pending = await cache.getPendingMutations();
      const failedMut = pending.find((m) => m.id === mut.id);

      expect(failedMut).toBeDefined();
      expect(failedMut?.status).toBe('FAILED');
      expect(failedMut?.retryCount).toBe(1);
      expect(failedMut?.lastError).toContain('HTTP 503');
    });
  });

  describe('Problem Set Caching', () => {
    it('caches and retrieves complete problem set item', async () => {
      await cache.cacheProblem({
        id: 'problem-lru-cache',
        title: 'LRU Cache Design',
        slug: 'lru-cache',
        description: 'Implement LRU cache data structure',
        difficulty: 'HARD',
        starterCode: { typescript: 'class LRUCache {}' },
        testCases: [{ input: '[[2], [1, 1]]', expectedOutput: '[null, null]' }],
        cachedAt: Date.now(),
      });

      const cached = await cache.getCachedProblem('problem-lru-cache');
      expect(cached).not.toBeNull();
      expect(cached?.title).toBe('LRU Cache Design');
      expect(cached?.difficulty).toBe('HARD');
    });
  });
});
