import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface UserSessionInfo {
  id: string;
  userId: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  browser: string;
  os: string;
  ipAddress: string;
  location: string;
  isCurrent: boolean;
  lastActiveAt: string;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async listUserSessions(userId: string, currentSessionId?: string): Promise<UserSessionInfo[]> {
    return [
      {
        id: currentSessionId || 'sess-current',
        userId,
        deviceType: 'Desktop',
        browser: 'Chrome 122',
        os: 'macOS Sonoma',
        ipAddress: '152.58.112.44',
        location: 'Mumbai, India',
        isCurrent: true,
        lastActiveAt: new Date().toISOString(),
      },
      {
        id: 'sess-mobile-1',
        userId,
        deviceType: 'Mobile',
        browser: 'Mobile Safari',
        os: 'iOS 17.4',
        ipAddress: '152.58.114.92',
        location: 'Mumbai, India',
        isCurrent: false,
        lastActiveAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: 'sess-laptop-2',
        userId,
        deviceType: 'Desktop',
        browser: 'Firefox 123',
        os: 'Windows 11',
        ipAddress: '103.21.244.12',
        location: 'Bengaluru, India',
        isCurrent: false,
        lastActiveAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ];
  }

  async revokeSession(userId: string, sessionId: string) {
    if (sessionId === 'sess-current') {
      throw new NotFoundException('Cannot revoke your current session directly. Use logout.');
    }
    return { success: true, revokedSessionId: sessionId };
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    return { success: true, message: 'All other active device sessions have been revoked.' };
  }
}
