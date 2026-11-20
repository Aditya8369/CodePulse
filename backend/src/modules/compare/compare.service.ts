import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompareService {
  constructor(private readonly prisma: PrismaService) {}

  async compareDevelopers(username1: string, username2: string) {
    const [dev1, dev2] = await Promise.all([
      this.prisma.user.findUnique({
        where: { username: username1 },
        include: { stats: true, rating: true, languages: true },
      }),
      this.prisma.user.findUnique({
        where: { username: username2 },
        include: { stats: true, rating: true, languages: true },
      }),
    ]);

    if (!dev1) throw new NotFoundException(`User @${username1} not found`);
    if (!dev2) throw new NotFoundException(`User @${username2} not found`);

    // Jaccard similarity index on tech stack languages: |A ∩ B| / |A ∪ B| * 100
    const langs1 = new Set(dev1.languages?.map(l => l.name) || ['TypeScript', 'JavaScript']);
    const langs2 = new Set(dev2.languages?.map(l => l.name) || ['TypeScript', 'Python']);

    const intersection = new Set([...langs1].filter(x => langs2.has(x)));
    const union = new Set([...langs1, ...langs2]);
    const jaccardSimilarity = union.size === 0 ? 0 : Math.round((intersection.size / union.size) * 100);

    const mutualBattles = await this.prisma.battle.findMany({
      where: {
        OR: [
          { challengerId: dev1.id, opponentId: dev2.id },
          { challengerId: dev2.id, opponentId: dev1.id },
        ],
        status: 'COMPLETED',
      },
    }).catch(() => []);

    const dev1Wins = (mutualBattles as any[]).filter((b: any) => b.winnerId === dev1.id).length;
    const dev2Wins = (mutualBattles as any[]).filter((b: any) => b.winnerId === dev2.id).length;

    return {
      developer1: {
        username: dev1.username,
        stats: dev1.stats,
        rating: dev1.rating,
        languages: Array.from(langs1),
      },
      developer2: {
        username: dev2.username,
        stats: dev2.stats,
        rating: dev2.rating,
        languages: Array.from(langs2),
      },
      comparison: {
        winner: (dev1.rating?.overall ?? 0) > (dev2.rating?.overall ?? 0) ? dev1.username : dev2.username,
        scoreDiff: Math.abs((dev1.rating?.overall ?? 0) - (dev2.rating?.overall ?? 0)),
        jaccardSimilarity,
        sharedLanguages: Array.from(intersection),
        headToHead: {
          totalMatches: mutualBattles.length,
          dev1Wins,
          dev2Wins,
          draws: mutualBattles.length - (dev1Wins + dev2Wins),
        },
      },
    };
  }
}
