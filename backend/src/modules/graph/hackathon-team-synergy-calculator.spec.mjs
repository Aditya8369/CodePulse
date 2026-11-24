import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class HackathonTeamSynergyCalculatorService {
  synergy(team, target) {
    const s = new Set();
    team.forEach(m => m.skills.forEach(x => s.add(x.toLowerCase())));
    let cov = 0;
    target.forEach(t => { if (s.has(t.toLowerCase())) cov++; });
    return Math.round((cov / target.length) * 100);
  }
}

describe('HackathonTeamSynergyCalculatorService (#2372)', () => {
  test('calculates cross-functional skill coverage for balanced hackathon teams', () => {
    const calc = new HackathonTeamSynergyCalculatorService();
    const team = [
      { id: '1', skills: ['React', 'CSS'] },
      { id: '2', skills: ['NestJS', 'PostgreSQL'] }
    ];
    const targets = ['React', 'NestJS', 'PostgreSQL', 'Figma'];
    const score = calc.synergy(team, targets);
    assert.strictEqual(score, 75); // 3 of 4 covered
  });
});
