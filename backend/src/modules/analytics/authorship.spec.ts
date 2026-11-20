import {
  analyzeAuthorship,
  concentration,
  degreeOfAuthorship,
  type AuthorshipCommit,
} from './authorship';

const commit = (
  sha: string,
  author: string,
  filename: string,
  status = 'modified',
): AuthorshipCommit => ({ sha, author, files: [{ filename, status }] });

describe('DOA authorship and contributor concentration', () => {
  it('uses the published DOA coefficients', () => {
    expect(degreeOfAuthorship(true, 2, 3)).toBeCloseTo(
      3.293 + 1.098 + 0.328 - 0.321 * Math.log(4),
      10,
    );
  });
  it('flags solo ownership as critical and reports its module concentration', () => {
    const report = analyzeAuthorship([
      commit('1', 'alice', 'src/core.ts', 'added'),
    ]);
    expect(report.busFactor).toBe(1);
    expect(report.risk).toBe('CRITICAL');
    expect(report.entropy).toBe(0);
    expect(report.modules[0]).toMatchObject({
      directory: 'src',
      dominantShare: 1,
      singlePointOfFailure: true,
    });
  });
  it('uses entropy 1 and Gini 0 for balanced authors, and concentration for uneven distributions', () => {
    expect(concentration([10, 10])).toEqual({ entropy: 1, gini: 0 });
    expect(concentration([1, 9]).entropy).toBeCloseTo(0.46899559);
    expect(concentration([1, 9]).gini).toBeCloseTo(0.4);
    expect(concentration([])).toEqual({ entropy: 0, gini: 0 });
  });
  it('balanced independent modules require multiple authors to lose more than half of coverage', () => {
    const report = analyzeAuthorship(
      ['a', 'b', 'c', 'd'].map((author, i) =>
        commit(String(i), author, `${author}/core.ts`, 'added'),
      ),
    );
    expect(report.busFactor).toBe(3);
    expect(report.score).toBe(3);
    expect(report.entropy).toBeCloseTo(1);
    expect(report.gini).toBeCloseTo(0);
    expect(report.risk).toBe('HEALTHY');
    expect(report.modules.every((m) => m.singlePointOfFailure)).toBe(true);
  });
  it('preserves ownership through rename, excludes removed paths and de-duplicates commits', () => {
    const added = commit('1', 'alice', 'old/file.ts', 'added');
    const renamed = {
      sha: '2',
      author: 'alice',
      files: [
        {
          filename: 'new/file.ts',
          previous_filename: 'old/file.ts',
          status: 'renamed',
        },
      ],
    };
    const report = analyzeAuthorship([added, added, renamed]);
    expect(report.observedFiles).toBe(1);
    expect(report.firstAuthorshipUnknown).toBe(0);
    expect(report.modules[0].directory).toBe('new');
    expect(report.modules[0].contributions).toBe(2);
    expect(
      analyzeAuthorship([
        added,
        renamed,
        commit('3', 'alice', 'new/file.ts', 'removed'),
      ]).busFactor,
    ).toBeNull();
  });
  it('does not invent first authorship for existing files, and empty history remains unknown', () => {
    const sample = analyzeAuthorship([commit('1', 'alice', 'file.ts')]);
    expect(sample.firstAuthorshipUnknown).toBe(1);
    expect(analyzeAuthorship([])).toMatchObject({
      risk: 'UNKNOWN',
      busFactor: null,
      score: null,
    });
  });
  it('applies a strict greater-than-80% single-owner threshold and bounds the display score', () => {
    const trace = Array.from({ length: 5 }, (_, i) =>
      commit(
        String(i),
        i === 4 ? 'bob' : 'alice',
        'file.ts',
        i === 0 ? 'added' : 'modified',
      ),
    );
    expect(analyzeAuthorship(trace).modules[0].singlePointOfFailure).toBe(
      false,
    );
    const many = Array.from({ length: 30 }, (_, i) =>
      commit(String(i), `a${i}`, `file${i}`, 'added'),
    );
    expect(analyzeAuthorship(many).score).toBe(10);
    expect(analyzeAuthorship(many).busFactor).toBe(16);
  });
});
