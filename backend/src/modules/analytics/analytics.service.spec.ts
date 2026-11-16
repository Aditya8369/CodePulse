import axios from 'axios';
import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import type { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

function setup(isPrivate = false) {
  const store = new Map<string, unknown>();
  const cache = {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => { store.set(key, value); }),
  };
  const repository = {
    findFirst: jest.fn().mockResolvedValue({ id: 'repo-1', fullName: 'owner/project', isPrivate }),
  };
  const service = new AnalyticsService(
    { repository } as unknown as PrismaService,
    { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService,
    cache as unknown as Cache,
  );
  return { service, repository, cache };
}

describe('repository commit punchcard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('buckets actual commit timestamps across a timezone day boundary and reuses cached commits', async () => {
    const get = jest.spyOn(axios, 'get').mockResolvedValue({
      data: [{ commit: { committer: { date: '2026-11-13T23:30:00Z' } } }],
    });
    const { service, repository, cache } = setup();
    const utc = await service.getRepositoryCommitPunchcard('user-1', 'repo-1', 'UTC');
    const india = await service.getRepositoryCommitPunchcard('user-1', 'repo-1', 'Asia/Kolkata');

    expect(utc.matrix).toHaveLength(7);
    expect(utc.matrix.every((row) => row.length === 24)).toBe(true);
    expect(utc.matrix[4][23]).toBe(1); // Friday 23:30 UTC
    expect(india.matrix[5][5]).toBe(1); // Saturday 05:00 IST
    expect(india.sampledCommits).toBe(1);
    expect(india.truncated).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(repository.findFirst).toHaveBeenCalledWith({ where: { id: 'repo-1', userId: 'user-1' } });
  });

  it('rejects invalid timezones and private repositories without fetching GitHub', async () => {
    const get = jest.spyOn(axios, 'get');
    const { service } = setup(true);
    await expect(service.getRepositoryCommitPunchcard('user-1', 'repo-1', 'not/a-zone')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getRepositoryCommitPunchcard('user-1', 'repo-1', 'UTC')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(get).not.toHaveBeenCalled();
  });

  it('does not fetch a repository outside the signed-in user', async () => {
    const get = jest.spyOn(axios, 'get');
    const { service, repository } = setup();
    repository.findFirst.mockResolvedValueOnce(null);
    await expect(service.getRepositoryCommitPunchcard('other-user', 'repo-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(get).not.toHaveBeenCalled();
  });

  it('returns an empty matrix for a GitHub repository without commits', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue({ isAxiosError: true, response: { status: 409 } });
    const { service } = setup();
    const result = await service.getRepositoryCommitPunchcard('user-1', 'repo-1');
    expect(result.sampledCommits).toBe(0);
    expect(result.matrix.flat().every((count) => count === 0)).toBe(true);
  });
});
