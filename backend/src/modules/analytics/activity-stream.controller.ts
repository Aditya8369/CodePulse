import { Controller, Get, Param, Sse, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable, interval, map } from 'rxjs';

@ApiTags('analytics')
@Controller('analytics')
export class ActivityStreamController {
  @Sse('stream/:username')
  @ApiOperation({ summary: 'Stream live developer GitHub activity pulse via Server-Sent Events' })
  streamUserActivity(@Param('username') username: string): Observable<MessageEvent> {
    const activities = [
      { type: 'LIVE_PUSH', repo: 'CodePulse', commits: 2, msg: 'feat: add realtime arena' },
      { type: 'PR_OPENED', repo: 'react-nexus', pr: 14, title: 'Optimized hydration loop' },
      { type: 'STAR_RECEIVED', repo: 'dev-arsenal', starsTotal: 142 },
      { type: 'STREAK_EXTENDED', streak: 18, msg: 'Day 18 milestone unlocked!' },
    ];

    return interval(8000).pipe(
      map((idx) => {
        const item = activities[idx % activities.length];
        return {
          data: {
            ...item,
            username,
            timestamp: new Date().toISOString(),
          },
        } as MessageEvent;
      })
    );
  }
}
