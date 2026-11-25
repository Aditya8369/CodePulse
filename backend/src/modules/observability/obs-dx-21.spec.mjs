import assert from 'node:assert/strict';
import { DeveloperOnboardingWizardService } from './obs-dx-21.service.ts';

const wizard = new DeveloperOnboardingWizardService(20);

// Node validation test
const n1 = wizard.validateNodeVersion('v24.18.0');
assert.strictEqual(n1.valid, true);
assert.strictEqual(n1.majorVersion, 24);

const n2 = wizard.validateNodeVersion('v18.12.1');
assert.strictEqual(n2.valid, false);

// Mock checks
const mockDocker = async () => true;
const mockDb = async () => ({ connected: true, latencyMs: 12 });
const mockSeeder = async () => ({ tables: 8, records: 1250 });

const report = await wizard.runOnboarding('v24.18.0', mockDocker, mockDb, mockSeeder);
assert.strictEqual(report.isReady, true);
assert.strictEqual(report.environment.nodeValid, true);
assert.strictEqual(report.environment.dockerActive, true);
assert.strictEqual(report.environment.databaseConnected, true);
assert.strictEqual(report.seed.success, true);
assert.strictEqual(report.seed.recordsInserted, 1250);
assert.ok(report.summaryMessage.includes('Ready to code'));

console.log('Issue #3201 [OBS-DX-21] spec passed successfully.');
