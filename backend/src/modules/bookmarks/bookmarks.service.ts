import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface BookmarkPayload {
  userId: string;
  targetType: 'DEVELOPER' | 'REPOSITORY';
  targetId: string;
  title: string;
  avatarUrl?: string;
  tags?: string[];
  notes?: string;
}

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  // In-memory collection fallback if DB table not yet migrated
  private static bookmarks: Array<BookmarkPayload & { id: string; createdAt: Date }> = [
    {
      id: 'bm_1',
      userId: 'user_default',
      targetType: 'DEVELOPER',
      targetId: 'alexmercer',
      title: 'Alex Mercer',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop',
      tags: ['mentor', 'typescript', 'rust'],
      notes: 'Strong distributed systems engineer. Reached out for code review.',
      createdAt: new Date(),
    },
    {
      id: 'bm_2',
      userId: 'user_default',
      targetType: 'REPOSITORY',
      targetId: 'codepulse/core',
      title: 'CodePulse Core Engine',
      avatarUrl: 'https://github.com/github.png',
      tags: ['inspiration', 'architecture'],
      notes: 'Clean NestJS module layout with Prisma integration.',
      createdAt: new Date(),
    },
  ];

  async getBookmarks(userId: string, tag?: string) {
    let results = BookmarksService.bookmarks.filter(b => b.userId === userId || userId === 'user_default');
    if (tag) {
      results = results.filter(b => b.tags?.includes(tag));
    }
    return results;
  }

  async createBookmark(data: BookmarkPayload) {
    const existing = BookmarksService.bookmarks.find(
      b => b.userId === data.userId && b.targetType === data.targetType && b.targetId === data.targetId
    );
    if (existing) throw new ConflictException('Already bookmarked');

    const newBookmark = {
      ...data,
      id: `bm_${Date.now()}`,
      createdAt: new Date(),
    };
    BookmarksService.bookmarks.push(newBookmark);
    return newBookmark;
  }

  async updateNotes(id: string, notes: string) {
    const item = BookmarksService.bookmarks.find(b => b.id === id);
    if (!item) throw new NotFoundException('Bookmark not found');
    item.notes = notes;
    return item;
  }

  async deleteBookmark(id: string) {
    const index = BookmarksService.bookmarks.findIndex(b => b.id === id);
    if (index === -1) throw new NotFoundException('Bookmark not found');
    BookmarksService.bookmarks.splice(index, 1);
    return { success: true };
  }
}
