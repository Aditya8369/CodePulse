import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class AutomatedPatchSynthesizerService {
  synthesizePatch(deps, advisories) {
    const u = { ...deps };
    let c = 0;
    for (const a of advisories) {
      if (u[a.packageName] === a.affectedVersion) { u[a.packageName] = a.patchedVersion; c++; }
    }
    return { updatedDependencies: u, appliedPatches: c };
  }
}

describe('AutomatedPatchSynthesizerService (Issue #1858)', () => {
  it('should auto-synthesize dependency version bumps to mitigate CVE advisories', () => {
    const synthesizer = new AutomatedPatchSynthesizerService();
    const deps = { express: '4.18.2', lodash: '4.17.15' };
    const advisories = [{ packageName: 'lodash', affectedVersion: '4.17.15', patchedVersion: '4.17.21', cveId: 'CVE-2021-23337' }];

    const res = synthesizer.synthesizePatch(deps, advisories);
    assert.equal(res.appliedPatches, 1);
    assert.equal(res.updatedDependencies.lodash, '4.17.21');
  });
});
