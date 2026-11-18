import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type SettingsRecord = Record<string, unknown>;
const THEMES = ['default', 'cyberpunk', 'synthwave', 'nord', 'dracula'];
const COLOR_VISION = [
  'normal',
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'monochrome',
];
const ACCENTS = ['purple', 'blue', 'emerald', 'orange', 'pink'];
const LANDING_TABS = [
  'dashboard',
  'analytics',
  'battles',
  'repositories',
  'leaderboard',
  'challenges',
];
const NOTIFICATION_KEYS = [
  'battleChallenges',
  'weeklyDigest',
  'achievementUnlocks',
  'leaderboardUpdates',
  'challengeReminders',
  'productUpdates',
];

function record(value: unknown): SettingsRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as SettingsRecord)
    : null;
}

function readableAccent(value: string): boolean {
  if (!/^#[0-9a-f]{6}$/i.test(value)) return false;
  const channels = [1, 3, 5].map((index) => {
    const rgb = parseInt(value.slice(index, index + 2), 16) / 255;
    return rgb <= 0.04045 ? rgb / 12.92 : ((rgb + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return 1.05 / (luminance + 0.05) >= 4.5;
}

function validateAppearance(value: unknown): SettingsRecord {
  const input = record(value);
  if (!input) throw new BadRequestException('appearance must be an object');
  const result: SettingsRecord = {};
  const choices: Record<string, string[]> = {
    theme: ['dark', 'light', 'system'],
    accentColor: ACCENTS,
    colorVisionTheme: COLOR_VISION,
    developerTheme: THEMES,
    defaultLandingTab: LANDING_TABS,
  };
  for (const [key, options] of Object.entries(choices)) {
    if (key in input) {
      if (typeof input[key] !== 'string' || !options.includes(input[key])) {
        throw new BadRequestException(`Invalid ${key}`);
      }
      result[key] = input[key];
    }
  }
  for (const key of ['compactTableView', 'reducedMotion']) {
    if (key in input) {
      if (typeof input[key] !== 'boolean')
        throw new BadRequestException(`Invalid ${key}`);
      result[key] = input[key];
    }
  }
  if ('customAccent' in input) {
    if (
      input.customAccent !== null &&
      (typeof input.customAccent !== 'string' ||
        !readableAccent(input.customAccent))
    ) {
      throw new BadRequestException('Custom accent must meet WCAG AA contrast');
    }
    result.customAccent = input.customAccent;
  }
  return result;
}

function validateNotifications(value: unknown): SettingsRecord {
  const input = record(value);
  if (!input) throw new BadRequestException('notifications must be an object');
  const result: SettingsRecord = {};
  for (const key of NOTIFICATION_KEYS) {
    if (key in input) {
      if (typeof input[key] !== 'boolean')
        throw new BadRequestException(`Invalid ${key}`);
      result[key] = input[key];
    }
  }
  return result;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user.settings;
  }

  async updateUserSettings(userId: string, value: unknown) {
    const input = record(value);
    if (!input || (!('appearance' in input) && !('notifications' in input))) {
      throw new BadRequestException('No settings provided');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const previous = record(user.settings) ?? {};
    const next = {
      appearance: {
        ...(record(previous.appearance) ?? {}),
        ...('appearance' in input ? validateAppearance(input.appearance) : {}),
      },
      notifications: {
        ...(record(previous.notifications) ?? {}),
        ...('notifications' in input
          ? validateNotifications(input.notifications)
          : {}),
      },
    };
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { settings: next as Prisma.InputJsonValue },
      select: { settings: true },
    });
    return updated.settings;
  }
}
