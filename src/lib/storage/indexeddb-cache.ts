/**
 * CodePulse Offline-First IndexedDB Storage & Conflict-Free Mutation Queue
 * Stores problem sets, code drafts, and in-flight match submissions with idempotency keys.
 */

export type MutationType = 'SUBMIT_SOLUTION' | 'RUN_TESTS' | 'SAVE_DRAFT';
export type MutationStatus = 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED';

export interface OfflineMutation {
  id: string; // Idempotency UUID
  type: MutationType;
  payload: {
    battleId?: string;
    problemId: string;
    code: string;
    language: string;
    clientTimestamp: number;
    version?: number;
  };
  status: MutationStatus;
  retryCount: number;
  lastError?: string;
  createdAt: number;
  syncedAt?: number;
}

export interface CodeDraftItem {
  problemId: string;
  code: string;
  language: string;
  updatedAt: number;
  version: number;
}

export interface ProblemCacheItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  starterCode: Record<string, string>;
  testCases: Array<{ input: string; expectedOutput: string }>;
  cachedAt: number;
}

const DB_NAME = 'CodePulse_Offline_DB';
const DB_VERSION = 1;

// In-memory fallback for SSR and headless node/test environments
class InMemoryOfflineStore {
  drafts = new Map<string, CodeDraftItem>();
  problems = new Map<string, ProblemCacheItem>();
  mutations = new Map<string, OfflineMutation>();

  async saveDraft(draft: CodeDraftItem): Promise<void> {
    const existing = this.drafts.get(draft.problemId);
    if (!existing || draft.updatedAt >= existing.updatedAt) {
      this.drafts.set(draft.problemId, draft);
    }
  }

  async getDraft(problemId: string): Promise<CodeDraftItem | null> {
    return this.drafts.get(problemId) || null;
  }

  async saveProblem(problem: ProblemCacheItem): Promise<void> {
    this.problems.set(problem.id, problem);
  }

  async getProblem(problemId: string): Promise<ProblemCacheItem | null> {
    return this.problems.get(problemId) || null;
  }

  async addMutation(mutation: OfflineMutation): Promise<void> {
    this.mutations.set(mutation.id, mutation);
  }

  async getPendingMutations(): Promise<OfflineMutation[]> {
    return Array.from(this.mutations.values())
      .filter((m) => m.status === 'PENDING' || m.status === 'FAILED')
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async updateMutation(id: string, status: MutationStatus, error?: string): Promise<void> {
    const mut = this.mutations.get(id);
    if (mut) {
      mut.status = status;
      if (status === 'COMPLETED') mut.syncedAt = Date.now();
      if (error) {
        mut.lastError = error;
        mut.retryCount++;
      }
    }
  }

  async removeMutation(id: string): Promise<void> {
    this.mutations.delete(id);
  }

  async clearCompleted(): Promise<void> {
    for (const [id, m] of this.mutations.entries()) {
      if (m.status === 'COMPLETED') {
        this.mutations.delete(id);
      }
    }
  }
}

const inMemoryStore = new InMemoryOfflineStore();

export class IndexedDBCache {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private isIdbSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  }

  private async getDb(): Promise<IDBDatabase | null> {
    if (!this.isIdbSupported()) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('codeDrafts')) {
            db.createObjectStore('codeDrafts', { keyPath: 'problemId' });
          }
          if (!db.objectStoreNames.contains('problems')) {
            db.createObjectStore('problems', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('mutationQueue')) {
            const store = db.createObjectStore('mutationQueue', { keyPath: 'id' });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Saves or reconciles a code draft using Conflict-Free Last-Write-Wins (LWW)
   */
  async saveDraft(problemId: string, code: string, language = 'typescript'): Promise<void> {
    const draft: CodeDraftItem = {
      problemId,
      code,
      language,
      updatedAt: Date.now(),
      version: 1,
    };

    const db = await this.getDb();
    if (!db) {
      await inMemoryStore.saveDraft(draft);
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction('codeDrafts', 'readwrite');
      const store = tx.objectStore('codeDrafts');
      const getReq = store.get(problemId);

      getReq.onsuccess = () => {
        const existing = getReq.result as CodeDraftItem | undefined;
        if (!existing || draft.updatedAt >= existing.updatedAt) {
          draft.version = (existing?.version ?? 0) + 1;
          store.put(draft);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getDraft(problemId: string): Promise<CodeDraftItem | null> {
    const db = await this.getDb();
    if (!db) {
      return inMemoryStore.getDraft(problemId);
    }

    return new Promise((resolve) => {
      const tx = db.transaction('codeDrafts', 'readonly');
      const store = tx.objectStore('codeDrafts');
      const req = store.get(problemId);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  /**
   * Enqueues an offline mutation with an idempotent UUID
   */
  async enqueueMutation(
    type: MutationType,
    payload: OfflineMutation['payload'],
    explicitId?: string,
  ): Promise<OfflineMutation> {
    const mutation: OfflineMutation = {
      id: explicitId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      type,
      payload: {
        ...payload,
        clientTimestamp: payload.clientTimestamp || Date.now(),
      },
      status: 'PENDING',
      retryCount: 0,
      createdAt: Date.now(),
    };

    const db = await this.getDb();
    if (!db) {
      await inMemoryStore.addMutation(mutation);
      return mutation;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction('mutationQueue', 'readwrite');
      const store = tx.objectStore('mutationQueue');
      store.put(mutation);

      tx.oncomplete = () => resolve(mutation);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPendingMutations(): Promise<OfflineMutation[]> {
    const db = await this.getDb();
    if (!db) {
      return inMemoryStore.getPendingMutations();
    }

    return new Promise((resolve) => {
      const tx = db.transaction('mutationQueue', 'readonly');
      const store = tx.objectStore('mutationQueue');
      const req = store.getAll();

      req.onsuccess = () => {
        const results = (req.result as OfflineMutation[] || [])
          .filter((m) => m.status === 'PENDING' || m.status === 'FAILED')
          .sort((a, b) => a.createdAt - b.createdAt);
        resolve(results);
      };
      req.onerror = () => resolve([]);
    });
  }

  async updateMutationStatus(
    id: string,
    status: MutationStatus,
    lastError?: string,
  ): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      await inMemoryStore.updateMutation(id, status, lastError);
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction('mutationQueue', 'readwrite');
      const store = tx.objectStore('mutationQueue');
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const mut = getReq.result as OfflineMutation | undefined;
        if (mut) {
          mut.status = status;
          if (status === 'COMPLETED') mut.syncedAt = Date.now();
          if (lastError) {
            mut.lastError = lastError;
            mut.retryCount++;
          }
          store.put(mut);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async removeMutation(id: string): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      await inMemoryStore.removeMutation(id);
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction('mutationQueue', 'readwrite');
      const store = tx.objectStore('mutationQueue');
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearCompletedMutations(): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      await inMemoryStore.clearCompleted();
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction('mutationQueue', 'readwrite');
      const store = tx.objectStore('mutationQueue');
      const req = store.getAll();

      req.onsuccess = () => {
        const mutations = req.result as OfflineMutation[];
        for (const m of mutations) {
          if (m.status === 'COMPLETED') {
            store.delete(m.id);
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async cacheProblem(problem: ProblemCacheItem): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      await inMemoryStore.saveProblem(problem);
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction('problems', 'readwrite');
      const store = tx.objectStore('problems');
      store.put(problem);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedProblem(problemId: string): Promise<ProblemCacheItem | null> {
    const db = await this.getDb();
    if (!db) {
      return inMemoryStore.getProblem(problemId);
    }

    return new Promise((resolve) => {
      const tx = db.transaction('problems', 'readonly');
      const store = tx.objectStore('problems');
      const req = store.get(problemId);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }
}

export const offlineCache = new IndexedDBCache();
