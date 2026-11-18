export const RETRY_POLICY = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnFail: false,
};
export const SOURCE_QUEUES = [
  'challenges',
  'leaderboard-sync',
  'github-sync',
] as const;
