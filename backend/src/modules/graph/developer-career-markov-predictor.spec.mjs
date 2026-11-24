import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DeveloperCareerMarkovPredictorService {
  constructor() { this.t = new Map(); }
  set(from, to, p) {
    if (!this.t.has(from)) this.t.set(from, new Map());
    this.t.get(from).set(to, p);
  }
  predict(from) {
    const map = this.t.get(from);
    if (!map) return { stage: from, p: 1 };
    let best = from, max = -1;
    for (const [s, p] of map.entries()) {
      if (p > max) { max = p; best = s; }
    }
    return { stage: best, p: max };
  }
}

describe('DeveloperCareerMarkovPredictorService (#2375)', () => {
  test('predicts highest-probability next career transition state using Markov matrix', () => {
    const predictor = new DeveloperCareerMarkovPredictorService();
    predictor.set('JUNIOR', 'MID', 0.8);
    predictor.set('JUNIOR', 'LEAD', 0.05);
    predictor.set('JUNIOR', 'JUNIOR', 0.15);

    const res = predictor.predict('JUNIOR');
    assert.strictEqual(res.stage, 'MID');
    assert.strictEqual(res.p, 0.8);
  });
});
