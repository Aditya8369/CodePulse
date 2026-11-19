# Security Policy

At **CodePulse**, the security of our platform, contributors, and user data is our highest priority. We take security vulnerabilities seriously and appreciate the efforts of security researchers and open-source contributors who report vulnerabilities in a responsible manner.

---

## 1. Supported Versions

We actively provide security updates and patches for the following versions:

| Version | Supported | Status |
| :--- | :---: | :--- |
| `main` (Latest) | :white_check_mark: | Actively supported with automated security scanning |
| `< 1.0.0` | :x: | Older releases / tags are not actively maintained |

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability in CodePulse, **please DO NOT open a public GitHub issue, discussion, or pull request.** Public disclosure can expose users to unnecessary risk before a fix is ready.

### Preferred Reporting Method
1. **GitHub Private Vulnerability Reporting (Recommended):**
   - Navigate to the **[Security tab](https://github.com/code-with-abhi-i5/CodePulse/security)** of this repository.
   - Click on **"Report a vulnerability"** (Advisories).
   - Provide a clear summary, steps to reproduce, proof of concept (PoC), and potential impact.

2. **Direct Maintainer Contact:**
   - If GitHub Private Reporting is unavailable, you may contact the lead maintainer directly via email:
   - **Email:** `ghoshabhijit1295@gmail.com`
   - **Subject Line:** `[CodePulse Security] Vulnerability Report: <Brief Description>`

### What to Include in Your Report
To help us triage and resolve the issue quickly, please provide:
* **Description:** A detailed explanation of the vulnerability.
* **Component Affected:** Frontend, NestJS backend, Docker container, or CI/CD workflow.
* **Reproduction Steps:** Step-by-step instructions or minimal reproduction scripts.
* **Impact Assessment:** What an attacker could achieve if the vulnerability were exploited.
* **Proposed Mitigation (Optional):** Suggested patch or remediation steps if you have them.

---

## 3. Response & Remediation SLA

We are committed to responding promptly to all valid security disclosures:

* **Initial Response:** Within **48 hours** of receiving your report.
* **Triage & Validation:** Within **5 business days**, confirming severity and scope.
* **Patch Development & Release:** Critical vulnerabilities are patched within **7 to 14 days**.
* **Public Disclosure:** Coordinated disclosure after the patch has been released and verified in production.

---

## 4. Platform Security Defenses

CodePulse enforces a multi-layered security defense model:

1. **Secret Scanning & Push Protection:** Real-time prevention of accidental credentials, API keys, or private tokens committed to git.
2. **Dependabot Alerts & Automated Security Fixes:** Daily vulnerability scanning across all npm and GitHub Actions dependencies.
3. **Container Security Scanning (Trivy):** Continuous vulnerability audits of Docker images and base operating system layers before deployment.
4. **CodeQL Static Analysis:** Automated Semantic Code Analysis scanning for injection flaws, authentication bypasses, and data leaks.
5. **NSoC'26 Compliance Gatekeeper:** Quality and git hygiene verification on every incoming pull request.

---

## 5. Security Recognition

We believe in recognizing ethical security researchers:
* Contributors and researchers who report valid, previously unknown security issues following our responsible disclosure process will be acknowledged on our **Contributors Wall** and **Security Hall of Fame**.

Thank you for helping keep CodePulse and the open-source community safe!
