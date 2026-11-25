import assert from 'node:assert/strict';
import { IncidentPostMortemExporterService } from './obs-dx-23.service.ts';

const exporter = new IncidentPostMortemExporterService();

const incident = {
  incidentId: 'INC-2026-1102',
  title: 'Redis Cluster Memory Fragmentation Degradation',
  severity: 'SEV1',
  startedAt: '2026-11-25 04:12 UTC',
  mitigatedAt: '2026-11-25 04:45 UTC',
  leadInvestigator: 'Dipak K.',
  customerImpact: '3.2% of API requests observed elevated latency during morning traffic ramp-up.',
  rootCause: 'Redis maxmemory eviction policy reached saturation without proactive keyspace defragmentation.',
  timeline: [
    { timestamp: '04:12 UTC', source: 'PROMETHEUS', description: 'Alert RedisHighMemoryUtilization fired' },
    { timestamp: '04:18 UTC', source: 'SLACK', author: '@oncall', description: 'Investigating Redis shard 2 connection spike' },
    { timestamp: '04:45 UTC', source: 'ENGINEER', author: '@dipak', description: 'Compaction daemon executed and memory freed' }
  ],
  actionItems: [
    { id: 'ACT-01', priority: 'P0', title: 'Deploy automatic memory defragmentation cron', owner: '@infra', ticketRef: 'INFRA-890' },
    { id: 'ACT-02', priority: 'P1', title: 'Tune Prometheus alert thresholds to 80%', owner: '@sre', ticketRef: 'SRE-124' }
  ]
};

const validation = exporter.validateIncidentData(incident);
assert.strictEqual(validation.valid, true);

const md = exporter.generateMarkdown(incident);
assert.ok(md.includes('# Incident Post-Mortem: Redis Cluster Memory Fragmentation Degradation'));
assert.ok(md.includes('| 04:12 UTC | PROMETHEUS |'));
assert.ok(md.includes('| ACT-01 | P0 | Deploy automatic memory defragmentation cron |'));

console.log('Issue #3203 [OBS-DX-23] spec passed successfully.');
