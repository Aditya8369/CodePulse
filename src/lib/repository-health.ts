export interface RepositoryHealth {
  hasReadme: boolean | null;
  hasLicense: boolean;
  hasContributing: boolean | null;
  hasCi: boolean | null;
  openIssues: number | null;
  closedIssues: number | null;
  /** Empty string means the repository has no commits; null means GitHub was unavailable. */
  lastCommitAt: string | null;
}

export interface HealthCategory {
  label: string;
  points: number | null;
  max: number;
  detail: string;
  recommendation: string;
}

export function scoreRepositoryHealth(health: RepositoryHealth, license: string | null, now = Date.now()) {
  const issueTotal = health.openIssues !== null && health.closedIssues !== null
    ? health.openIssues + health.closedIssues : null;
  // Closure share is an observable triage signal, not a measured response time.
  const closureShare = issueTotal === null ? null : issueTotal === 0 ? 0 : health.closedIssues! / issueTotal;
  const commitAge = health.lastCommitAt === null ? null : health.lastCommitAt === "" ? Infinity
    : (now - new Date(health.lastCommitAt).getTime()) / 86_400_000;
  const categories: HealthCategory[] = [
    {
      label: "License", points: health.hasLicense ? 20 : 0, max: 20,
      detail: health.hasLicense ? `Detected: ${license || "license"}` : "No license detected",
      recommendation: "Add an open source LICENSE file so contributors know how the code may be used.",
    },
    {
      label: "Documentation",
      points: health.hasReadme === null && health.hasContributing === null ? null
        : (health.hasReadme ? 10 : 0) + (health.hasContributing ? 10 : 0),
      max: (health.hasReadme === null ? 0 : 10) + (health.hasContributing === null ? 0 : 10),
      detail: `README: ${status(health.hasReadme)} · CONTRIBUTING: ${status(health.hasContributing)}`,
      recommendation: "Add a README and CONTRIBUTING.md with setup, usage, and contribution steps.",
    },
    {
      label: "CI workflow", points: health.hasCi === null ? null : health.hasCi ? 20 : 0, max: health.hasCi === null ? 0 : 20,
      detail: `GitHub Actions: ${status(health.hasCi)}`,
      recommendation: "Add a GitHub Actions workflow that runs tests for pull requests.",
    },
    {
      label: "Issue triage", points: closureShare === null ? null : closureShare >= 0.5 ? 20 : closureShare >= 0.2 ? 10 : 0, max: closureShare === null ? 0 : 20,
      detail: closureShare === null ? "Issue history unavailable" : `${Math.round(closureShare * 100)}% of recorded issues closed (triage proxy)`,
      recommendation: "Review open issues and close resolved reports with a clear explanation.",
    },
    {
      label: "Recent commits", points: commitAge === null || Number.isNaN(commitAge) ? null : commitAge <= 30 ? 20 : commitAge <= 90 ? 10 : 0, max: commitAge === null || Number.isNaN(commitAge) ? 0 : 20,
      detail: commitAge === null || Number.isNaN(commitAge) ? "Commit history unavailable" : commitAge === Infinity ? "No commits found" : `Latest commit ${Math.max(0, Math.floor(commitAge))} days ago`,
      recommendation: "Resume maintained, reviewed changes and publish a recent commit.",
    },
  ];
  const available = categories.reduce((sum, category) => sum + category.max, 0);
  const earned = categories.reduce((sum, category) => sum + (category.points || 0), 0);
  const score = available === 0 ? null : Math.round(earned / available * 100);
  const grade = score === null ? "—" : score >= 95 ? "A+" : score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  return { categories, score, grade, available, provisional: available < 100 };
}

function status(value: boolean | null) {
  return value === null ? "Unavailable" : value ? "Present" : "Missing";
}
