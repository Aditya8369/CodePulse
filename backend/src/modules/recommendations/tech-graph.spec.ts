import {
  cosine,
  graphCentrality,
  normalize,
  recommendTech,
} from './tech-graph';
describe('technology progression ranking', () => {
  it('normalizes only positive finite evidence and handles zero vectors', () => {
    expect(normalize({ JavaScript: 10, Python: 30, Rust: NaN, C: -1 })).toEqual(
      { JavaScript: 0.25, Python: 0.75 },
    );
    expect(cosine({}, { Python: 1 })).toBe(0);
    expect(cosine({ JavaScript: 1 }, { JavaScript: 5 })).toBeCloseTo(1);
    expect(cosine({ JavaScript: 1 }, { Python: 1 })).toBe(0);
  });
  it('conserves centrality mass, including dangling graph nodes', () => {
    const rank = graphCentrality();
    expect(Object.values(rank).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
    expect(Object.values(rank).every((n) => Number.isFinite(n) && n > 0)).toBe(
      true,
    );
  });
  it('prefers a direct TypeScript progression for JavaScript evidence and includes bounded multi-step paths', () => {
    const result = recommendTech({ JavaScript: 100 }, []);
    expect(result[0].technology).toBe('TypeScript');
    expect(result[0].path).toEqual(['JavaScript', 'TypeScript']);
    expect(result.some((r) => r.path.length === 3)).toBe(true);
    expect(
      result.every(
        (r) =>
          r.score >= 0 &&
          r.score <= 100 &&
          r.starterChallenge &&
          r.estimatedPracticeHours > 0,
      ),
    ).toBe(true);
  });
  it('excludes established technologies and changes collaborative components from similar peers only', () => {
    const own = { JavaScript: 0.8, TypeScript: 0.2 };
    const baseline = recommendTech(own, []);
    const result = recommendTech(own, [
      { JavaScript: 1, Go: 4 },
      { C: 100, Rust: 1 },
    ]);
    expect(result.some((r) => r.technology === 'TypeScript')).toBe(false);
    expect(
      result.find((r) => r.technology === 'Go')!.components.collaborative,
    ).toBeGreaterThan(0);
    expect(
      result.find((r) => r.technology === 'Rust')!.components.collaborative,
    ).toBe(0);
    expect(
      baseline.find((r) => r.technology === 'Go')!.components.collaborative,
    ).toBe(0);
  });
  it('does not fabricate personal suggestions without supported evidence', () => {
    expect(recommendTech({}, [])).toEqual([]);
    expect(
      recommendTech({ UnknownLanguage: 100 }, [{ JavaScript: 100 }]),
    ).toEqual([]);
  });
});
