import axios from 'axios';
import {
  BadGatewayException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import type { PrismaService } from '../../prisma/prisma.service';
import { BusFactorService } from './bus-factor.service';
const SHA = 'a'.repeat(40);
function setup() {
  const values = new Map();
  const cache = {
    get: jest.fn(async (key: string) => values.get(key)),
    set: jest.fn(async (key: string, data: unknown) => {
      values.set(key, data);
    }),
  };
  const repository = {
    findFirst: jest
      .fn()
      .mockResolvedValue({
        id: 'repo',
        fullName: 'owner/project',
        isPrivate: false,
      }),
  };
  const service = new BusFactorService(
    { repository } as unknown as PrismaService,
    { get: jest.fn() } as unknown as ConfigService,
    cache as unknown as Cache,
  );
  return { service, repository, cache };
}
function github() {
  return jest
    .spyOn(axios, 'get')
    .mockResolvedValueOnce({ data: [{ sha: SHA }], headers: {} })
    .mockResolvedValueOnce({
      data: {
        author: { login: 'ALICE' },
        parents: [],
        files: [{ filename: 'src/core.ts', status: 'added' }],
      },
      headers: {},
    });
}
describe('repository bus factor service', () => {
  afterEach(() => jest.restoreAllMocks());
  it('retrieves real file traces, caches the result and still authorizes every request', async () => {
    const get = github();
    const { service, cache, repository } = setup();
    const report = await service.getReport('u', 'repo');
    expect(report).toMatchObject({
      busFactor: 1,
      sampledCommits: 1,
      partial: false,
    });
    expect(report.modules[0].dominantAuthor).toBe('alice');
    expect(await service.getReport('u', 'repo')).toEqual(report);
    expect(get).toHaveBeenCalledTimes(2);
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(repository.findFirst).toHaveBeenCalledWith({
      where: { id: 'repo', userId: 'u' },
    });
    repository.findFirst.mockResolvedValueOnce(null);
    await expect(service.getReport('other', 'repo')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(get).toHaveBeenCalledTimes(2);
  });
  it('rejects private repositories before any upstream request', async () => {
    const get = jest.spyOn(axios, 'get');
    const { service, repository } = setup();
    repository.findFirst.mockResolvedValueOnce({
      fullName: 'owner/private',
      isPrivate: true,
    });
    await expect(service.getReport('u', 'repo')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(get).not.toHaveBeenCalled();
  });
  it('represents empty repositories as unknown rather than healthy', async () => {
    jest
      .spyOn(axios, 'get')
      .mockRejectedValue({ isAxiosError: true, response: { status: 409 } });
    const { service } = setup();
    expect(await service.getReport('u', 'repo')).toMatchObject({
      risk: 'UNKNOWN',
      busFactor: null,
      sampledCommits: 0,
    });
  });
  it('does not cache failed or malformed upstream responses', async () => {
    jest
      .spyOn(axios, 'get')
      .mockResolvedValue({ data: [{ sha: '../../bad' }], headers: {} });
    const { service, cache } = setup();
    await expect(service.getReport('u', 'repo')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(cache.set).not.toHaveBeenCalled();
  });
  it('marks truncated history and unlinked/missing identities as partial without disclosing emails', async () => {
    jest
      .spyOn(axios, 'get')
      .mockResolvedValueOnce({
        data: [{ sha: SHA }],
        headers: { link: '<next>; rel="next"' },
      })
      .mockResolvedValueOnce({
        data: {
          commit: { author: { email: 'private@example.com' } },
          parents: [],
          files: [{ filename: 'src/core.ts', status: 'modified' }],
        },
        headers: {},
      });
    const { service } = setup();
    const report = await service.getReport('u', 'repo');
    expect(report.partial).toBe(true);
    expect(report.firstAuthorshipUnknown).toBe(1);
    expect(JSON.stringify(report)).not.toContain('private@example.com');
  });
  it('skips merge diffs rather than double-counting their authors', async () => {
    jest
      .spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: [{ sha: SHA }], headers: {} })
      .mockResolvedValueOnce({
        data: {
          author: { login: 'merger' },
          parents: [{ sha: 'x' }, { sha: 'y' }],
          files: [],
        },
        headers: {},
      });
    const { service } = setup();
    expect(await service.getReport('u', 'repo')).toMatchObject({
      risk: 'UNKNOWN',
      sampledCommits: 0,
    });
  });
});
