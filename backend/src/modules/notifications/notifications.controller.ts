import { BadRequestException, Controller, Get, Patch, Param, Sse, MessageEvent, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Observable, interval, map } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user notifications' })
  async getMyNotifications(@Request() req: { user: { id: string } }) {
    return this.notificationsService.getUserNotifications(req.user.id);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'Server-Sent Events stream for real-time notifications' })
  streamNotifications(): Observable<MessageEvent> {
    return interval(15000).pipe(
      map((count) => ({
        data: {
          event: 'heartbeat',
          timestamp: new Date().toISOString(),
          unreadCount: 0,
        },
      } as MessageEvent))
    );
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  async markAllAsRead(@Request() req: { user: { id: string } }) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Patch('read-category/:category')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark one notification category as read for current user' })
  async markCategoryAsRead(@Request() req: { user: { id: string } }, @Param('category') category: string) {
    const result = await this.notificationsService.markCategoryAsRead(req.user.id, category);
    if (result === null) throw new BadRequestException('Unknown notification category');
    return result;
  }
}
