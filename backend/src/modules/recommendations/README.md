# Technology progression suggestions (#338)

Authenticated `GET /api/v1/recommendations/tech-stack` uses the caller's public,
non-archived repositories. It reads real language-byte distributions from GitHub,
normalizes each repository and weights it by `1 + log(1 + commits)`.

A small, curated directed graph supplies one- and two-step progression paths.
Personalized affinity (70%), cosine-weighted primary-language co-occurrence among
similar public repository profiles (20%), and PageRank centrality (10%) rank the
next technologies. Already established languages (>= 15% of evidence) are omitted.
The top five suggestions include paths, reasoning, starter tasks and illustrative
practice-hour estimates. No labor-market feed or learned proficiency model is
claimed. Cold starts return an empty list rather than fabricated personalization.

Evidence is bounded to ten own repositories and 1,000 public peer repository
records; `partial` signals sampling. Peer IDs never appear in responses. Private
repositories are excluded before network access. GitHub failures return 502 and
are not cached. The seven-day cache is per user and repository revision; syncing
new evidence changes the cache key. Peer changes take effect after expiry.

From `backend/`, run:

```sh
npm test -- --runInBand src/modules/recommendations
npm run build
```

AI-assisted with Codex. All external calls in tests are mocked.
