import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiParam, ApiTags,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('Bearer')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Xem danh sách thông báo của mình' })
  getMyNotifications(
    @CurrentUser() user: any,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationService.getMyNotifications(user.sub, query);
  }

  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Gửi thông báo thủ công cho IB trong subtree' })
  send(@CurrentUser() user: any, @Body() dto: SendNotificationDto) {
    return this.notificationService.send(user.sub, dto);
  }

  // QUAN TRỌNG: route /read-all phải đặt TRƯỚC /:id để tránh conflict
  @Patch('read-all')
  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo đã đọc' })
  markAllAsRead(@CurrentUser() user: any) {
    return this.notificationService.markAllAsRead(user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu 1 thông báo đã đọc' })
  @ApiParam({ name: 'id', description: 'UUID của thông báo' })
  markAsRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationService.markAsRead(user.sub, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa 1 thông báo của mình' })
  @ApiParam({ name: 'id', description: 'UUID của thông báo' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationService.remove(user.sub, id);
  }
}
