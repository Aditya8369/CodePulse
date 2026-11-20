import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchGlobal(query: string) {
    if (!query || query.length < 2) {
      return { users: [], repositories: [] };
    }

    // Attempt performant PostgreSQL pg_trgm similarity search with fallback to indexed contains
    try {
      const trgmUsers = await this.prisma.$queryRawUnsafe<Array<{ id: string; username: string; avatar: string | null; name: string | null }>>(
        `SELECT id, username, avatar, name 
         FROM users 
         WHERE username % $1 OR name % $1 
         ORDER BY similarity(username, $1) DESC 
         LIMIT 10`,
        query
      );

      if (trgmUsers && trgmUsers.length > 0) {
        const repositories = await this.prisma.repository.findMany({
          where: {
            archivedAt: null,
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          select: { id: true, name: true, fullName: true, language: true, stars: true, userId: true },
          take: 10,
        });

        return { users: trgmUsers, repositories };
      }
    } catch {
      // Graceful fallback to standard indexed query
    }

    const [users, repositories] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
            { bio: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, username: true, avatar: true, name: true },
        take: 10,
      }),
      this.prisma.repository.findMany({
        where: {
          archivedAt: null,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, fullName: true, language: true, stars: true, userId: true },
        take: 10,
      }),
    ]);

    return { users, repositories };
  }
}
