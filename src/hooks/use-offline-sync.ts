'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  offlineCache,
  OfflineMutation,
  MutationType,
} from '@/lib/storage/indexeddb-cache';

export interface UseOfflineSyncOptions {
  onSyncSuccess?: (mutation: OfflineMutation, serverResponse: unknown) => void;
  onSyncFailure?: (mutation: OfflineMutation, error: Error) => void;
  heartbeatIntervalMs?: number; // Safari fallback heartbeat poll (default: 15000ms)
  apiEndpoint?: string; // Default: '/api/battles/submit'
}

export interface UseOfflineSyncReturn {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
  queueSubmission: (params: {
    problemId: string;
    code: string;
    language: string;
    battleId?: string;
    type?: MutationType;
  }) => Promise<OfflineMutation>;
  saveDraft: (problemId: string, code: string, language?: string) => Promise<void>;
  syncNow: () => Promise<{ synced: number; failed: number }>;
}

export function useOfflineSync(options: UseOfflineSyncOptions = {}): UseOfflineSyncReturn {
  const {
    onSyncSuccess,
    onSyncFailure,
    heartbeatIntervalMs = 15000,
    apiEndpoint = '/api/battles/submit',
  } = options;

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const isSyncingRef = useRef<boolean>(false);

  // Refresh pending count
  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await offlineCache.getPendingMutations();
      setPendingCount(pending.length);
    } catch {
      // ignore
    }
  }, []);

  // Sync draining engine
  const syncNow = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (isSyncingRef.current) return { synced: 0, failed: 0 };
    isSyncingRef.current = true;
    setIsSyncing(true);

    let synced = 0;
    let failed = 0;

    try {
      const pending = await offlineCache.getPendingMutations();

      for (const mutation of pending) {
        try {
          await offlineCache.updateMutationStatus(mutation.id, 'SYNCING');

          // POST submission to server with Idempotency Key header
          const res = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': mutation.id,
              'X-Client-Timestamp': String(mutation.payload.clientTimestamp),
            },
            body: JSON.stringify({
              idempotencyKey: mutation.id,
              problemId: mutation.payload.problemId,
              battleId: mutation.payload.battleId,
              code: mutation.payload.code,
              language: mutation.payload.language,
              clientTimestamp: mutation.payload.clientTimestamp,
            }),
          });

          if (!res.ok) {
            throw new Error(`Server returned HTTP ${res.status}`);
          }

          const responseData = await res.json().catch(() => ({}));
          await offlineCache.updateMutationStatus(mutation.id, 'COMPLETED');
          synced++;
          onSyncSuccess?.(mutation, responseData);
        } catch (err: unknown) {
          failed++;
          const errorMsg = err instanceof Error ? err.message : String(err);
          await offlineCache.updateMutationStatus(mutation.id, 'FAILED', errorMsg);
          onSyncFailure?.(mutation, err instanceof Error ? err : new Error(errorMsg));
        }
      }

      await offlineCache.clearCompletedMutations();
      setLastSyncedAt(Date.now());
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      await refreshPendingCount();
    }

    return { synced, failed };
  }, [apiEndpoint, onSyncSuccess, onSyncFailure, refreshPendingCount]);

  // Handle Online / Offline network transition events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      // Trigger instant background sync drain on network restore
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    refreshPendingCount();

    // Safari & Mobile Chrome heartbeat fallback poll
    const heartbeat = setInterval(() => {
      if (typeof navigator !== 'undefined') {
        const currentlyOnline = navigator.onLine;
        setIsOnline(currentlyOnline);
        if (currentlyOnline && pendingCount > 0 && !isSyncingRef.current) {
          syncNow();
        }
      }
    }, heartbeatIntervalMs);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(heartbeat);
    };
  }, [syncNow, pendingCount, heartbeatIntervalMs, refreshPendingCount]);

  // Queue an offline code submission
  const queueSubmission = useCallback(
    async (params: {
      problemId: string;
      code: string;
      language: string;
      battleId?: string;
      type?: MutationType;
    }): Promise<OfflineMutation> => {
      const mutation = await offlineCache.enqueueMutation(
        params.type ?? 'SUBMIT_SOLUTION',
        {
          problemId: params.problemId,
          battleId: params.battleId,
          code: params.code,
          language: params.language,
          clientTimestamp: Date.now(),
        },
      );

      await refreshPendingCount();

      // If currently online, attempt immediate sync
      if (isOnline) {
        syncNow();
      }

      return mutation;
    },
    [isOnline, syncNow, refreshPendingCount],
  );

  const saveDraft = useCallback(
    async (problemId: string, code: string, language = 'typescript'): Promise<void> => {
      await offlineCache.saveDraft(problemId, code, language);
    },
    [],
  );

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncedAt,
    queueSubmission,
    saveDraft,
    syncNow,
  };
}
