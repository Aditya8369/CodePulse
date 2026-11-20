export interface WeeklyDigestData {
  username: string;
  name: string;
  commitsThisWeek: number;
  prsThisWeek: number;
  starsGainedThisWeek: number;
  rankCurrent: number;
  rankDelta: number;
  recommendedRival: {
    username: string;
    score: number;
    avatarUrl?: string;
  };
  activeQuest: {
    title: string;
    progress: number;
    goal: number;
  };
  unsubscribeUrl: string;
}

export function renderWeeklyDigestHtml(data: WeeklyDigestData): string {
  const rankDeltaSymbol = data.rankDelta >= 0 ? `▲ ${data.rankDelta}` : `▼ ${Math.abs(data.rankDelta)}`;
  const rankColor = data.rankDelta >= 0 ? '#10b981' : '#ef4444';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your CodePulse Weekly Digest</title>
  <style>
    body {
      background-color: #0b0f19;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 20px auto;
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 8px 0 0;
      color: #c7d2fe;
      font-size: 14px;
    }
    .content {
      padding: 32px 24px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 24px;
      color: #f8fafc;
    }
    .stats-grid {
      display: table;
      width: 100%;
      margin-bottom: 28px;
    }
    .stat-box {
      display: table-cell;
      width: 33.33%;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    .stat-number {
      font-size: 24px;
      font-weight: 800;
      color: #60a5fa;
      margin-bottom: 4px;
    }
    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #9ca3af;
    }
    .rank-banner {
      background: #182234;
      border: 1px solid #2563eb;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card-section {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .card-title {
      font-size: 14px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }
    .rival-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .btn-action {
      display: inline-block;
      background: #6366f1;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 13px;
    }
    .progress-bar-bg {
      background: #334155;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      margin: 10px 0;
    }
    .progress-bar-fill {
      background: #10b981;
      height: 100%;
    }
    .footer {
      border-top: 1px solid #1f2937;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    .footer a {
      color: #9ca3af;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>CodePulse Weekly Pulse</h1>
      <p>Your performance breakdown & competitive intel</p>
    </div>
    <div class="content">
      <div class="greeting">Hey ${data.name || data.username}, here is your weekly summary:</div>

      <table class="stats-grid" cellspacing="8">
        <tr>
          <td class="stat-box">
            <div class="stat-number">${data.commitsThisWeek}</div>
            <div class="stat-label">Commits</div>
          </td>
          <td class="stat-box">
            <div class="stat-number">${data.prsThisWeek}</div>
            <div class="stat-label">Pull Requests</div>
          </td>
          <td class="stat-box">
            <div class="stat-number">${data.starsGainedThisWeek}</div>
            <div class="stat-label">Stars Gained</div>
          </td>
        </tr>
      </table>

      <div class="rank-banner">
        <div>
          <div style="font-size: 12px; color: #94a3b8;">Global Leaderboard Rank</div>
          <div style="font-size: 20px; font-weight: 800; color: #f8fafc;">#${data.rankCurrent}</div>
        </div>
        <div style="font-size: 16px; font-weight: 700; color: ${rankColor};">
          ${rankDeltaSymbol} positions
        </div>
      </div>

      <div class="card-section">
        <div class="card-title">⚔️ Recommended Battle Rival</div>
        <div class="rival-box">
          <div>
            <strong style="color: #f1f5f9; font-size: 15px;">@${data.recommendedRival.username}</strong>
            <div style="font-size: 12px; color: #94a3b8;">Rating: ${data.recommendedRival.score} XP</div>
          </div>
          <a href="https://codepulse.dev/battles/create?target=${data.recommendedRival.username}" class="btn-action">Challenge</a>
        </div>
      </div>

      <div class="card-section">
        <div class="card-title">🎯 Active Quest Progress</div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #e2e8f0;">
          <span>${data.activeQuest.title}</span>
          <span>${data.activeQuest.progress} / ${data.activeQuest.goal}</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${Math.min(100, Math.round((data.activeQuest.progress / data.activeQuest.goal) * 100))}%;"></div>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>You received this email because you opted into weekly performance digests.</p>
      <p><a href="${data.unsubscribeUrl}">Unsubscribe from Weekly Digest</a> | <a href="https://codepulse.dev/settings">Notification Settings</a></p>
    </div>
  </div>
</body>
</html>
  `;
}
