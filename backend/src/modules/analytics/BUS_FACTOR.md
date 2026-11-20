# Repository authorship estimate

`GET /api/v1/repositories/:id/bus-factor` requires JWT authentication and a
repository record owned by the caller. Private repositories are not supported.

The service retrieves up to 50 recent commits from the public repository's default
branch, then loads each commit's file changes. Merge diffs are excluded. It replays
changes oldest first, preserving observed renames and excluding deleted files.
Missing history, unknown first authorship and truncated GitHub file pages set
`partial: true`. Unlinked identities use hashed identifiers; raw author emails are
not returned. Reports are cached for 15 minutes, after an ownership check.

This is a bounded **estimate over observed files**, not a full-project knowledge
measurement. The DOA formula and authorship thresholds follow
[Avelino et al. (ICPC 2016)](https://arxiv.org/abs/1604.06766): raw DOA > 3.293 and
normalized DOA > 0.75. Contributors are removed by descending owned-file count
until coverage falls below 50%. The raw result is `busFactor`; `score` caps it at
10. Entropy and Gini describe ownership concentration separately. Directory
concentration counts observed file-changing commits and flags shares > 80%.
Risk labels are a product heuristic: 1 critical, 2 moderate, 3+ healthy; no evidence
is unknown. Even a healthy aggregate can contain single-owner modules.

Run the analytics tests from `backend/`:

```sh
npm test -- --runInBand src/modules/analytics/authorship.spec.ts src/modules/analytics/bus-factor.service.spec.ts
npm run build
```

AI-assisted with Codex. No live GitHub credentials are required by the tests.
