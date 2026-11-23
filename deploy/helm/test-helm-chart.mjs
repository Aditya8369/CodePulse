import * as fs from 'fs';
import * as path from 'path';

const chartPath = path.resolve('deploy/helm/codepulse/Chart.yaml');
const valuesPath = path.resolve('deploy/helm/codepulse/values.yaml');
const hpaPath = path.resolve('deploy/helm/codepulse/templates/hpa.yaml');
const vpaPath = path.resolve('deploy/helm/codepulse/templates/vpa.yaml');
const deployPath = path.resolve('deploy/helm/codepulse/templates/deployment.yaml');

console.log('[HELM VALIDATOR] Validating CodePulse Helm 3 Chart...');

// 1. Validate Chart.yaml
if (!fs.existsSync(chartPath)) {
  console.error('FAIL: Chart.yaml missing');
  process.exit(1);
}
const chartContent = fs.readFileSync(chartPath, 'utf-8');
if (!chartContent.includes('name: codepulse') || !chartContent.includes('apiVersion: v2')) {
  console.error('FAIL: Chart.yaml invalid');
  process.exit(1);
}

// 2. Validate values.yaml
const valuesContent = fs.readFileSync(valuesPath, 'utf-8');
if (!valuesContent.includes('minReplicas: 3') || !valuesContent.includes('maxReplicas: 10')) {
  console.error('FAIL: Autoscaling min/max replicas not configured in values.yaml');
  process.exit(1);
}

// 3. Validate HPA template
const hpaContent = fs.readFileSync(hpaPath, 'utf-8');
if (!hpaContent.includes('kind: HorizontalPodAutoscaler') || !hpaContent.includes('averageUtilization')) {
  console.error('FAIL: HPA template missing key specs');
  process.exit(1);
}

// 4. Validate VPA template
const vpaContent = fs.readFileSync(vpaPath, 'utf-8');
if (!vpaContent.includes('kind: VerticalPodAutoscaler') || !vpaContent.includes('updateMode')) {
  console.error('FAIL: VPA template missing updateMode');
  process.exit(1);
}

// 5. Validate Pod Anti-Affinity
const deployContent = fs.readFileSync(deployPath, 'utf-8');
if (!deployContent.includes('affinity')) {
  console.error('FAIL: Pod anti-affinity missing from deployment template');
  process.exit(1);
}

console.log('[HELM VALIDATOR] All 5 Kubernetes Helm validation checks PASSED cleanly!');
process.exit(0);
