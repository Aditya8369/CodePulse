# CodePulse Model Context Protocol (MCP) Server

Official Model Context Protocol (MCP) server for CodePulse platform. Connect external AI coding assistants (**Claude Desktop**, **Cursor**, **Antigravity**, **Gemini CLI**) directly to developer telemetry, repositories, battles, and challenge evaluation engines.

---

## Capabilities & Architecture

- **Protocol Version**: MCP Specification v1.0 / `2024-11-05`
- **Supported Transports**: `stdio` (local subprocess) and Server-Sent Events (`sse` / HTTP REST)
- **Authentication**: Token-based with granular API keys (`cp_mcp_*`)
- **Rate Limiting**: Sliding window algorithm enforcing 60 requests/minute per client

---

## Exposed MCP Tools

1. **`get_developer_profile`**:
   - Query global developer rank, MMR rating, badge collection, and activity statistics.
   - *Arguments*: `username` (string, required).

2. **`query_repository_metrics`**:
   - Inspect code health score, open issues, pull request review latency, and coverage.
   - *Arguments*: `repositoryId` (string, required).

3. **`list_active_challenges`**:
   - Discover current algorithmic battles, difficulty tiers, and XP rewards.
   - *Arguments*: `difficulty` (optional: `EASY`, `MEDIUM`, `HARD`, `EXPERT`), `limit` (integer).

4. **`submit_challenge_solution`**:
   - Submit code solutions for sandboxed compilation and test case execution.
   - *Arguments*: `challengeId` (string), `language` (string), `code` (string).

5. **`run_code_benchmark`**:
   - Benchmark runtime execution duration, memory allocation, and time complexity.
   - *Arguments*: `language` (string), `code` (string), `iterations` (integer).

---

## Exposed MCP Resources

- `codepulse://repositories/{id}/analytics` - Live telemetry and commit analytics.
- `codepulse://battles/recent` - Scorecards for recently concluded 1v1 battles.
- `codepulse://badges/user` - Developer trophy case, tier milestones, and achievements.

---

## Claude Desktop Configuration Guide

To configure Claude Desktop to communicate with CodePulse MCP, add the following to your `claude_desktop_config.json`:

### macOS / Linux
`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codepulse": {
      "command": "node",
      "args": ["/path/to/CodePulse/backend/dist/modules/mcp/codepulse-mcp.server.js"],
      "env": {
        "CODEPULSE_MCP_API_KEY": "cp_mcp_your_api_key_here"
      }
    }
  }
}
```

### Windows
`%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codepulse": {
      "command": "node",
      "args": ["E:\\CodePulse\\backend\\dist\\modules\\mcp\\codepulse-mcp.server.js"],
      "env": {
        "CODEPULSE_MCP_API_KEY": "cp_mcp_your_api_key_here"
      }
    }
  }
}
```

---

## Testing & Verification

```bash
# Run unit tests for MCP server tools and resources
npm --prefix backend test -- src/modules/mcp/codepulse-mcp.server.spec.ts

# Run root Vitest suite
npm test -- src/services/mcp-server.test.ts
```
