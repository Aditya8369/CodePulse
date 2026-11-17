import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new SettingsService(prisma as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('reads only the authenticated user record', async () => {
    prisma.user.findUnique.mockResolvedValue({
      settings: { appearance: { developerTheme: 'nord' } },
    });
    await expect(service.getUserSettings('alice')).resolves.toEqual({
      appearance: { developerTheme: 'nord' },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'alice' },
      select: { settings: true },
    });
  });

  it('merges validated palette changes without erasing notifications', async () => {
    prisma.user.findUnique.mockResolvedValue({
      settings: {
        appearance: { theme: 'dark' },
        notifications: { weeklyDigest: false },
      },
    });
    prisma.user.update.mockImplementation(
      ({ data }: { data: { settings: unknown } }) =>
        Promise.resolve({ settings: data.settings }),
    );
    await expect(
      service.updateUserSettings('alice', {
        appearance: { developerTheme: 'dracula', customAccent: '#445a88' },
      }),
    ).resolves.toEqual({
      appearance: {
        theme: 'dark',
        developerTheme: 'dracula',
        customAccent: '#445a88',
      },
      notifications: { weeklyDigest: false },
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'alice' } }),
    );
  });

  it('rejects accents without 4.5:1 contrast before writing', async () => {
    prisma.user.findUnique.mockResolvedValue({ settings: null });
    await expect(
      service.updateUserSettings('alice', {
        appearance: { customAccent: '#ffffff' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
