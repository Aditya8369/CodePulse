import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DeveloperKnowledgeOntologyMapperService {
  constructor() { this.t = new Map(); }
  reg(s, d) { this.t.set(s.toLowerCase(), d); }
  map(skills) {
    const res = {};
    skills.forEach(s => {
      const d = this.t.get(s.toLowerCase()) || 'General';
      if (!res[d]) res[d] = [];
      res[d].push(s);
    });
    return res;
  }
}

describe('DeveloperKnowledgeOntologyMapperService (#2361)', () => {
  test('clusters developer skills into standardized ontology domains', () => {
    const mapper = new DeveloperKnowledgeOntologyMapperService();
    mapper.reg('PostgreSQL', 'Databases');
    mapper.reg('MongoDB', 'Databases');
    mapper.reg('React', 'Frontend');

    const grouped = mapper.map(['PostgreSQL', 'React', 'MongoDB', 'Docker']);
    assert.deepStrictEqual(grouped.Databases, ['PostgreSQL', 'MongoDB']);
    assert.deepStrictEqual(grouped.Frontend, ['React']);
    assert.deepStrictEqual(grouped.General, ['Docker']);
  });
});
