import { Controller, Get, Post, Delete, Patch, Body, Param, Query } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import type { BookmarkPayload } from './bookmarks.service';

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get()
  getBookmarks(@Query('userId') userId = 'user_default', @Query('tag') tag?: string) {
    return this.bookmarksService.getBookmarks(userId, tag);
  }

  @Post()
  createBookmark(@Body() data: BookmarkPayload) {
    return this.bookmarksService.createBookmark(data);
  }

  @Patch(':id/notes')
  updateNotes(@Param('id') id: string, @Body('notes') notes: string) {
    return this.bookmarksService.updateNotes(id, notes);
  }

  @Delete(':id')
  deleteBookmark(@Param('id') id: string) {
    return this.bookmarksService.deleteBookmark(id);
  }
}
