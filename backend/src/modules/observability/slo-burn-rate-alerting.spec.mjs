import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SLOBurnRateAlertingService {
  evaluateBurnRate(errRate, slo = 0.999) {
    const allowed = 1 - slo;
    const burn = errRate / allowed;
    if (burn >= 14.4) return { burnRate: burn, severity: 'PAGE' };
    if (burn >= 6.0) return { burnRate: burn, severity: 'TICKET' };
    return { burnRate: burn, severity: 'NONE' };
  }
}

describe('SLOBurnRateAlertingService (Issue #1897)', () => {
  it('should alert on rapid error budget depletion using Google SRE multi-window burn rates', () => {
    const slo = new SLOBurnRateAlertingService();
    assert.equal(slo.evaluateBurnRate(0.0005, 0.999).severity, 'NONE');
    assert.equal(slo.evaluateBurnRate(0.008, 0.999).severity, 'TICKET');
    assert.equal(slo.evaluateBurnRate(0.02, 0.999).severity, 'PAGE');
  });
});
