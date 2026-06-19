import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { getSubtreeIds } from '../../common/utils/subtree.util';
import { SendNotificationDto } from './dto/send-notification.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /notifications — xem thông báo của mình
   */
  async getMyNotifications(currentUserId: string, query: QueryNotificationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: any = { recipientId: currentUserId };
    if (query.isRead !== undefined) where.isRead = query.isRead;
    if (query.type) where.type = query.type;

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          sender: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { recipientId: currentUserId, isRead: false },
      }),
    ]);

    return { data: items, meta: { page, limit, total, unreadCount } };
  }

  /**
   * POST /notifications/send — gửi thông báo thủ công cho IB trong subtree
   */
  async send(currentUserId: string, dto: SendNotificationDto) {
    // Verify recipientId nằm trong subtree của currentUser
    const subtreeIds = await getSubtreeIds(this.prisma, currentUserId);
    const childIds = subtreeIds.filter((id) => id !== currentUserId);
    if (!childIds.includes(dto.recipientId)) {
      throw new ForbiddenException({ code: 'RECIPIENT_NOT_IN_SUBTREE' });
    }

    const notification = await this.prisma.notification.create({
      data: {
        recipientId: dto.recipientId,
        senderId: currentUserId,
        type: dto.type ?? NotificationType.MANUAL,
        title: dto.title,
        body: dto.body,
        metadata: dto.metadata as any,
      },
    });

    return notification;
  }

  /**
   * PATCH /notifications/:id/read — đánh dấu đã đọc
   */
  async markAsRead(currentUserId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) {
      throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND' });
    }
    if (notification.recipientId !== currentUserId) {
      throw new ForbiddenException({ code: 'NOTIFICATION_NOT_YOURS' });
    }
    if (notification.isRead) return notification; // idempotent

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * PATCH /notifications/read-all — đánh dấu tất cả đã đọc
   */
  async markAllAsRead(currentUserId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId: currentUserId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }

  /**
   * DELETE /notifications/:id — xóa thông báo của mình
   */
  async remove(currentUserId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) {
      throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND' });
    }
    if (notification.recipientId !== currentUserId) {
      throw new ForbiddenException({ code: 'NOTIFICATION_NOT_YOURS' });
    }
    await this.prisma.notification.delete({ where: { id: notificationId } });
    return { message: 'Đã xóa thông báo' };
  }

  /**
   * Internal — dùng từ các service khác để tạo system notification
   */
  async createSystemNotification(params: {
    recipientId: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      return await this.prisma.notification.create({
        data: {
          recipientId: params.recipientId,
          senderId: null, // system
          type: params.type,
          title: params.title,
          body: params.body,
          metadata: params.metadata as any,
        },
      });
    } catch {
      // Non-blocking — không để lỗi notification làm gián đoạn luồng chính
    }
  }
}
