export interface FileChange {
  filename: string;
  status: string;
  previous_filename?: string;
}
export interface AuthorshipCommit {
  sha: string;
  author: string;
  files: FileChange[];
}

export function concentration(counts: number[]) {
  const values = counts
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const total = values.reduce((sum, n) => sum + n, 0);
  if (!total) return { entropy: 0, gini: 0 };
  const entropy =
    values.length < 2
      ? 0
      : -values.reduce((sum, n) => {
          const p = n / total;
          return sum + p * Math.log(p);
        }, 0) / Math.log(values.length);
  const gini =
    values.reduce(
      (sum, n, i) => sum + (2 * (i + 1) - values.length - 1) * n,
      0,
    ) /
    (values.length * total);
  return { entropy, gini };
}

// Avelino et al., ICPC 2016: https://arxiv.org/abs/1604.06766
export function degreeOfAuthorship(
  firstAuthor: boolean,
  deliveries: number,
  others: number,
) {
  return (
    3.293 +
    1.098 * Number(firstAuthor) +
    0.164 * deliveries -
    0.321 * Math.log(1 + others)
  );
}

/** Input is oldest-to-newest. Never infer first authorship from a truncated trace. */
export function analyzeAuthorship(commits: AuthorshipCommit[]) {
  const files = new Map<
    string,
    { first?: string; changes: Map<string, number> }
  >();
  const seen = new Set<string>();
  for (const commit of commits) {
    if (seen.has(commit.sha)) continue;
    seen.add(commit.sha);
    const changed = new Set<string>();
    for (const change of commit.files) {
      if (!change.filename || changed.has(change.filename)) continue;
      changed.add(change.filename);
      if (change.status === 'removed') {
        files.delete(change.filename);
        continue;
      }
      if (change.status === 'renamed' && change.previous_filename) {
        const previous = files.get(change.previous_filename);
        if (previous) files.set(change.filename, previous);
        files.delete(change.previous_filename);
      }
      if (change.status === 'added' || !files.has(change.filename)) {
        files.set(change.filename, {
          first: change.status === 'added' ? commit.author : undefined,
          changes: new Map(),
        });
      }
      const file = files.get(change.filename)!;
      file.changes.set(
        commit.author,
        (file.changes.get(commit.author) ?? 0) + 1,
      );
    }
  }
  const ownership = new Map<string, Set<string>>();
  const modules = new Map<string, Map<string, number>>();
  let firstAuthorshipUnknown = 0;
  for (const [path, file] of files) {
    if (!file.first) firstAuthorshipUnknown++;
    const total = [...file.changes.values()].reduce((sum, n) => sum + n, 0);
    const scores = [...file.changes].map(([author, count]) => ({
      author,
      doa: degreeOfAuthorship(file.first === author, count, total - count),
    }));
    const max = Math.max(...scores.map((s) => s.doa));
    // Published thresholds: raw DOA > 3.293 and normalized DOA > 0.75.
    ownership.set(
      path,
      new Set(
        scores
          .filter((s) => s.doa > 3.293 && s.doa / max > 0.75)
          .map((s) => s.author),
      ),
    );
    const directory = path.includes('/')
      ? path.slice(0, path.lastIndexOf('/'))
      : '(root)';
    if (!modules.has(directory)) modules.set(directory, new Map());
    for (const [author, count] of file.changes) {
      const module = modules.get(directory)!;
      module.set(author, (module.get(author) ?? 0) + count);
    }
  }
  const counts = new Map<string, number>();
  for (const owners of ownership.values()) {
    for (const owner of owners) counts.set(owner, (counts.get(owner) ?? 0) + 1);
  }
  const remaining = new Set(counts.keys());
  let busFactor = 0;
  const coverage = () =>
    [...ownership.values()].filter((owners) =>
      [...owners].some((a) => remaining.has(a)),
    ).length;
  while (files.size && coverage() / files.size >= 0.5 && remaining.size) {
    // Recompute coverage rank after each removal; deterministic tie ordering.
    const ranked = [...remaining].sort(
      (a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b),
    );
    remaining.delete(ranked[0]);
    busFactor++;
  }
  const moduleRisks = [...modules]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([directory, authors]) => {
      const total = [...authors.values()].reduce((sum, n) => sum + n, 0);
      const ranked = [...authors].sort(
        ([a, na], [b, nb]) => nb - na || a.localeCompare(b),
      );
      const share = ranked[0][1] / total;
      return {
        directory,
        contributions: total,
        contributors: authors.size,
        dominantAuthor: ranked[0][0],
        dominantShare: share,
        singlePointOfFailure: share > 0.8,
        ...concentration([...authors.values()]),
      };
    });
  const known = files.size > 0 && busFactor > 0;
  return {
    busFactor: known ? busFactor : null,
    score: known ? Math.min(10, busFactor) : null,
    risk: !known
      ? 'UNKNOWN'
      : busFactor === 1
        ? 'CRITICAL'
        : busFactor === 2
          ? 'MODERATE'
          : 'HEALTHY',
    observedFiles: files.size,
    firstAuthorshipUnknown,
    ownershipCoverage: files.size
      ? [...ownership.values()].filter((s) => s.size).length / files.size
      : 0,
    ...concentration([...counts.values()]),
    modules: moduleRisks,
    recommendations: !known
      ? ['Collect more history before assessing contributor risk.']
      : moduleRisks.some((m) => m.singlePointOfFailure)
        ? [
            'Pair reviewers and document handover for modules with more than 80% of changes by one contributor.',
          ]
        : [
            'Maintain shared reviews and spread module ownership across contributors.',
          ],
  };
}
