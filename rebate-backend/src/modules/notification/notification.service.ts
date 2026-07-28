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
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) { }

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
  async send(currentUserId: string, dto: SendNotificationDto, callerRole?: string) {
    // ADMIN: được gửi cho bất kỳ IB nào trong hệ thống
    if (callerRole !== 'ADMIN') {
      // IB thường: chỉ gửi cho con trực tiếp
      const target = await this.prisma.ibNode.findUnique({ where: { id: dto.recipientId }, select: { parentId: true } });
      if (!target || target.parentId !== currentUserId) {
        throw new ForbiddenException({ code: 'RECIPIENT_NOT_IN_SUBTREE' });
      }
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
   * GET /notifications/count — trả về số unread (dùng cho badge)
   */
  async getUnreadCount(ibId: string) {
    const count = await this.prisma.notification.count({
      where: { recipientId: ibId, isRead: false },
    });
    return { unreadCount: count };
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
    } catch (error) {
      console.error('[NotificationService] Failed to create notification:', {
        recipientId: params.recipientId,
        type: params.type,
        error: error.message
      });
      // Non-blocking — không để lỗi notification làm gián đoạn luồng chính
    }
  }

  /**
   * Internal — Admin sửa config của 1 IB, gửi thông báo theo scope
   * notifyScope = 'direct': chỉ gửi cho targetIbId
   * notifyScope = 'cascade': gửi cho targetIbId + toàn bộ chain cha (lên tới MIB root)
   */
  async notifyConfigChangedByAdmin(
    targetIbId: string,
    notifyScope: 'direct' | 'cascade',
    changes: Record<string, unknown>,
    adminId?: string,
  ) {
    // Fix: trước đây "changes.assets" chỉ được dùng để nhúng chữ vào body (text),
    // không hề lưu vào metadata dưới dạng mảng có cấu trúc — nên FE không thể biết
    // chính xác asset nào để highlight. Giờ lưu thêm "changedAssets" có cấu trúc.
    const changedAssets = (Array.isArray((changes as any)?.assets)
      ? ((changes as any).assets as Array<{ asset?: string; rebatePips?: number; markupPips?: number }>)
      : []
    )
      .filter((a) => !!a.asset)
      .map((a) => ({ assetType: a.asset, rebatePips: a.rebatePips, markupPips: a.markupPips }));

    const assetNames = changedAssets.map((a) => a.assetType).slice(0, 4);
    const summaryText = assetNames.length > 0
      ? ` (${assetNames.join(', ')}${changedAssets.length > 4 ? '...' : ''})`
      : '';

    const recipientIds: string[] = [targetIbId];

    if (notifyScope === 'cascade') {
      // Walk lên cây tới MIB root
      let currentId: string | null = targetIbId;
      while (currentId) {
        const targetNode: any = await this.prisma.ibNode.findUnique({
          where: { id: currentId },
          select: { parentId: true, level: true },
        });
        if (!targetNode || targetNode.parentId === null) break;
        recipientIds.push(targetNode.parentId);
        if (targetNode.level === 0) break; // đã ở MIB root
        currentId = targetNode.parentId;
      }
    }

    for (const recipientId of [...new Set(recipientIds)]) {
      // Fix: trước đây câu chữ luôn nói "của bạn" kể cả với các ancestor nhận
      // thông báo do CẤP DƯỚI của họ bị sửa (case cascade) — gây hiểu nhầm.
      // Giờ tách rõ: recipient chính là targetIbId (tự mình bị sửa) hay chỉ là
      // upline nhận thông báo cascade (cấp dưới của họ bị sửa).
      const isSelf = recipientId === targetIbId;
      const title = isSelf
        ? 'Cấu hình rebate của bạn đã bị Admin cập nhật'
        : 'Cấu hình rebate của cấp dưới trong nhánh bạn đã bị Admin cập nhật';
      const body = isSelf
        ? `Cấu hình rebate của bạn${summaryText} vừa được Admin cập nhật. Vui lòng kiểm tra thiết lập chi tiết.`
        : `Cấu hình rebate${summaryText} của 1 tài khoản trong nhánh của bạn vừa được Admin cập nhật. Vui lòng kiểm tra lại.`;

      await this.createSystemNotification({
        recipientId,
        type: NotificationType.REBATE_UPDATED,
        title,
        body,
        metadata: {
          adminId,
          targetIbId,
          scope: notifyScope,
          // Bọc trong "details" để đồng nhất cấu trúc với mọi loại notification
          // khác (Admin/MIB/IB đều đọc chung 1 shape ở FE).
          details: { targetIbId, changedAssets },
        },
      });
    }
  }

  /**
   * Admin duyệt hoặc báo lỗi thông báo chỉnh sửa của MIB/IB
   */
  async reviewNotification(
    adminId: string,
    notificationId: string,
    status: 'APPROVED' | 'REJECTED',
    reason?: string,
  ) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { sender: { select: { id: true, name: true, email: true } } },
    });

    if (!notification) {
      throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND', message: 'Không tìm thấy thông báo' });
    }

    const currentMeta = (notification.metadata as Record<string, any>) || {};
    const targetUserId = notification.senderId || currentMeta.actorId;

    const updatedMetadata = {
      ...currentMeta,
      reviewStatus: status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: adminId,
      reviewReason: reason || null,
    };

    // Update notification metadata & mark read
    const updatedNotification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        metadata: updatedMetadata,
        isRead: true,
        readAt: new Date(),
      },
    });

    // Fix: quyết định duyệt/từ chối của Admin — bản thân nó là 1 hành vi nhạy
    // cảm — trước đây chỉ nằm trong Notification.metadata (JSON tự do, không
    // filter được), giờ ghi thêm vào AuditLog trung tâm.
    await this.auditService.log({
      actorId: adminId,
      action: status === 'APPROVED' ? AUDIT_ACTIONS.ADMIN_REVIEW_APPROVED : AUDIT_ACTIONS.ADMIN_REVIEW_REJECTED,
      targetType: 'NOTIFICATION',
      targetId: notificationId,
      before: { reviewStatus: currentMeta.reviewStatus ?? 'PENDING' },
      after: {
        reviewStatus: status,
        reason: reason || null,
        originalActionType: currentMeta.actionType,
        originalActorId: currentMeta.actorId,
      },
    });

    // Send feedback notification to the MIB/IB
    if (targetUserId) {
      if (status === 'APPROVED') {
        await this.createSystemNotification({
          recipientId: targetUserId,
          type: NotificationType.SYSTEM,
          title: 'Chỉnh sửa đã được Admin duyệt thành công',
          body: `Admin đã kiểm tra và duyệt thành công các chỉnh sửa/thao tác "${notification.title}" của bạn trên hệ thống.`,
          metadata: { originalNotificationId: notificationId, status: 'APPROVED' },
        });
      } else {
        await this.createSystemNotification({
          recipientId: targetUserId,
          type: NotificationType.SYSTEM,
          title: 'Chỉnh sửa của bạn bị báo lỗi / chưa đạt yêu cầu',
          body: `Admin đã kiểm tra và báo lỗi thao tác "${notification.title}" của bạn. Yêu cầu: ${reason || 'Vui lòng kiểm tra lại thiết lập và chia hoa hồng xem đã khớp với hệ thống hay chưa.'
            }`,
          metadata: { originalNotificationId: notificationId, status: 'REJECTED', reason },
        });
      }
    }

    return updatedNotification;
  }

  /**
   * Thông báo cho tất cả Admin khi có MIB/IB thực hiện chỉnh sửa/thay đổi
   */
  async notifyAdminsOnIbAction(params: {
    actorId: string;
    title: string;
    body: string;
    actionType: string;
    details?: any;
  }) {
    try {
      const admins = await this.prisma.ibNode.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });

      const actor = await this.prisma.ibNode.findUnique({
        where: { id: params.actorId },
        select: { name: true, email: true, level: true },
      });

      for (const admin of admins) {
        await this.prisma.notification.create({
          data: {
            recipientId: admin.id,
            senderId: params.actorId,
            type: NotificationType.REBATE_UPDATED,
            title: params.title,
            body: params.body,
            metadata: {
              actorId: params.actorId,
              actorName: actor?.name || '',
              actorEmail: actor?.email || '',
              actorLevel: actor?.level,
              actionType: params.actionType,
              details: params.details,
              reviewStatus: 'PENDING',
            },
          },
        });
      }
    } catch (error) {
      console.error('[NotificationService] Failed to notify admins:', error.message);
    }
  }
}