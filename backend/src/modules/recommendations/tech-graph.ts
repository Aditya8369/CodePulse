export const TECH_GRAPH: Record<string, Record<string, number>> = {
  JavaScript: { TypeScript: 1, Python: 0.4 },
  TypeScript: { Go: 0.7, Rust: 0.4 },
  Python: { Go: 0.6, Rust: 0.4 },
  Java: { Kotlin: 1, Go: 0.5 },
  Kotlin: { Go: 0.4 },
  Go: { Rust: 0.8 },
  C: { 'C++': 1, Rust: 0.9 },
  'C++': { Rust: 1 },
  Ruby: { Python: 0.8, TypeScript: 0.5 },
  PHP: { TypeScript: 0.8, Go: 0.5 },
  Rust: {},
};
export type Vector = Record<string, number>;
export function normalize(vector: Vector): Vector {
  const entries = Object.entries(vector).filter(
    ([, n]) => Number.isFinite(n) && n > 0,
  );
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  return Object.fromEntries(entries.map(([key, n]) => [key, n / total]));
}
export function cosine(a: Vector, b: Vector) {
  const dot = Object.keys(a).reduce(
    (sum, key) => sum + a[key] * (b[key] ?? 0),
    0,
  );
  const norm = (v: Vector) =>
    Math.sqrt(Object.values(v).reduce((sum, n) => sum + n * n, 0));
  const denominator = norm(a) * norm(b);
  return denominator ? Math.max(0, Math.min(1, dot / denominator)) : 0;
}
export function graphCentrality() {
  const names = Object.keys(TECH_GRAPH);
  let rank: Vector = Object.fromEntries(
    names.map((name) => [name, 1 / names.length]),
  );
  for (let i = 0; i < 30; i++) {
    const next: Vector = Object.fromEntries(
      names.map((name) => [name, 0.15 / names.length]),
    );
    for (const name of names) {
      const edges = normalize(TECH_GRAPH[name]);
      if (!Object.keys(edges).length) {
        for (const target of names)
          next[target] += (0.85 * rank[name]) / names.length;
      } else {
        for (const [target, weight] of Object.entries(edges))
          next[target] += 0.85 * rank[name] * weight;
      }
    }
    rank = next;
  }
  return rank;
}
const STARTERS: Record<string, { task: string; hours: number }> = {
  JavaScript: {
    task: 'Build a keyboard-accessible task list with local persistence and tests.',
    hours: 12,
  },
  TypeScript: {
    task: 'Port a small JavaScript API client to strict TypeScript with runtime input validation.',
    hours: 16,
  },
  Python: {
    task: 'Build a CSV analysis CLI with input validation and unit tests.',
    hours: 16,
  },
  Go: {
    task: 'Build an HTTP service with context cancellation and table-driven tests.',
    hours: 24,
  },
  Rust: {
    task: 'Build a file-processing CLI using Result errors and ownership-safe iteration.',
    hours: 40,
  },
  Java: {
    task: 'Build a typed REST client with error handling and tests.',
    hours: 24,
  },
  Kotlin: {
    task: 'Port a Java utility using null safety and coroutine cancellation.',
    hours: 20,
  },
  C: {
    task: 'Build a bounded text parser with memory checks and malformed-input tests.',
    hours: 32,
  },
  'C++': {
    task: 'Build an RAII file utility with standard containers and unit tests.',
    hours: 32,
  },
  Ruby: { task: 'Build a tested command-line report generator.', hours: 16 },
  PHP: { task: 'Build a validated JSON endpoint with tests.', hours: 16 },
};

export function recommendTech(evidence: Vector, peers: Vector[]) {
  const mastery = normalize(evidence);
  const known = Object.keys(mastery).filter((name) =>
    Object.hasOwn(TECH_GRAPH, name),
  );
  if (!known.length) return [];
  const centrality = graphCentrality();
  const maxCentrality = Math.max(...Object.values(centrality));
  const similar = peers
    .map(normalize)
    .map((vector) => ({ vector, weight: cosine(mastery, vector) }))
    .filter((peer) => peer.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20);
  const totalWeight = similar.reduce((sum, peer) => sum + peer.weight, 0);
  const candidates = new Map<string, { affinity: number; path: string[] }>();
  for (const source of known) {
    for (const [target, edge] of Object.entries(TECH_GRAPH[source])) {
      const affinity = mastery[source] * edge;
      const current = candidates.get(target);
      if (!current || current.affinity < affinity)
        candidates.set(target, { affinity, path: [source, target] });
      for (const [second, nextEdge] of Object.entries(TECH_GRAPH[target])) {
        const nextAffinity = affinity * nextEdge * 0.5;
        const existing = candidates.get(second);
        if (!existing || existing.affinity < nextAffinity)
          candidates.set(second, {
            affinity: nextAffinity,
            path: [source, target, second],
          });
      }
    }
  }
  return [...candidates]
    .filter(([name]) => (mastery[name] ?? 0) < 0.15)
    .map(([technology, entry]) => {
      const collaborative = totalWeight
        ? similar.reduce(
            (sum, peer) => sum + peer.weight * (peer.vector[technology] ?? 0),
            0,
          ) / totalWeight
        : 0;
      const central = centrality[technology] / maxCentrality;
      const score = Math.min(
        1,
        0.7 * entry.affinity + 0.2 * collaborative + 0.1 * central,
      );
      const starter = STARTERS[technology];
      return {
        technology,
        score: Math.round(score * 100),
        path: entry.path,
        reasoning: `A curated progression from ${entry.path[0]}; ranked using language evidence, anonymized public-repository co-occurrence and progression-graph centrality.`,
        starterChallenge: starter.task,
        estimatedPracticeHours: starter.hours * (entry.path.length - 1),
        difficulty:
          entry.path.length > 2
            ? 'advanced progression'
            : technology === 'Rust'
              ? 'steeper learning curve'
              : 'incremental progression',
        components: {
          graphAffinity: entry.affinity,
          collaborative,
          centrality: central,
        },
      };
    })
    .sort(
      (a, b) => b.score - a.score || a.technology.localeCompare(b.technology),
    )
    .slice(0, 5);
}
