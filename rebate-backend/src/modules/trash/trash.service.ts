import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class TrashService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

  async findAllTrash() {
    return this.prisma.ibNode.findMany({
      where: { isActive: false },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isRootAdmin: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async restore(id: string, currentUserId: string, ipAddress?: string) {
    const target = await this.prisma.ibNode.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản',
      });
    }

    if (target.isActive) {
      throw new BadRequestException({
        code: 'USER_NOT_IN_TRASH',
        message: 'Tài khoản này chưa bị khóa',
      });
    }

    await this.prisma.ibNode.update({
      where: { id },
      data: { isActive: true },
    });

    await this.auditService.log({
      actorId: currentUserId,
      action: AUDIT_ACTIONS.IB_RESTORE,
      targetType: 'IB',
      targetId: id,
      after: { isActive: true },
      ipAddress,
    });

    // System notification: IB_RESTORED — gửi cho IB được khôi phục
    this.notificationService.createSystemNotification({
      recipientId: id,
      type: NotificationType.IB_RESTORED,
      title: 'Tai khoan da duoc khoi phuc',
      body: 'Tai khoan cua ban da duoc khoi phuc va co the dang nhap binh thuong.',
    });

    return { success: true, message: 'Khôi phục thành công' };
  }

  async hardDelete(id: string) {
    const target = await this.prisma.ibNode.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản',
      });
    }

    // Check relations manually to provide exact table names
    const configsCount = await this.prisma.rebateConfig.count({ where: { ibId: id } });
    if (configsCount > 0) throw new BadRequestException({ code: 'HAS_RELATIONS', message: 'Tài khoản này còn dữ liệu cấu hình (rebate_configs), không thể xóa vĩnh viễn' });

    const txsCount = await this.prisma.rebateTransaction.count({ where: { ibId: id } });
    if (txsCount > 0) throw new BadRequestException({ code: 'HAS_RELATIONS', message: 'Tài khoản này còn dữ liệu giao dịch (rebate_transactions), không thể xóa vĩnh viễn' });

    const createdTxsCount = await this.prisma.rebateTransaction.count({ where: { createdById: id } });
    if (createdTxsCount > 0) throw new BadRequestException({ code: 'HAS_RELATIONS', message: 'Tài khoản này là người tạo các giao dịch (rebate_transactions), không thể xóa vĩnh viễn' });

    const walletCount = await this.prisma.wallet.count({ where: { ibId: id } });
    if (walletCount > 0) throw new BadRequestException({ code: 'HAS_RELATIONS', message: 'Tài khoản này còn dữ liệu ví (wallets), không thể xóa vĩnh viễn' });

    const payoutsCount = await this.prisma.payout.count({ where: { ibId: id } });
    if (payoutsCount > 0) throw new BadRequestException({ code: 'HAS_RELATIONS', message: 'Tài khoản này còn dữ liệu rút tiền (payouts), không thể xóa vĩnh viễn' });

    const auditCount = await this.prisma.auditLog.count({ where: { actorId: id } });
    if (auditCount > 0) throw new BadRequestException({ code: 'HAS_RELATIONS', message: 'Tài khoản này còn lịch sử hoạt động (audit_logs), không thể xóa vĩnh viễn' });

    const historyCount = await this.prisma.rebateConfigHistory.count({ where: { changedById: id } });
    if (historyCount > 0) throw new BadRequestException({ code: 'HAS_RELATIONS', message: 'Tài khoản này còn lịch sử sửa cấu hình (rebate_config_history), không thể xóa vĩnh viễn' });

    const receivedNotiCount = await this.prisma.notification.count({ where: { recipientId: id } });
    if (receivedNotiCount > 0) throw new BadRequestException({ code: 'HAS_RELATIONS', message: 'Tài khoản này còn thông báo đã nhận (notifications), không thể xóa vĩnh viễn' });

    const sentNotiCount = await this.prisma.notification.count({ where: { senderId: id } });
    if (sentNotiCount > 0) throw new BadRequestException({ code: 'HAS_RELATIONS', message: 'Tài khoản này còn thông báo đã gửi (notifications), không thể xóa vĩnh viễn' });

    const tokensCount = await this.prisma.refreshToken.count({ where: { ibId: id } });
    if (tokensCount > 0) throw new BadRequestException({ code: 'HAS_RELATIONS', message: 'Tài khoản này còn refresh_tokens, không thể xóa vĩnh viễn' });

    const accountTemplatesCount = await this.prisma.accountTypeTemplate.count({ where: { ownerId: id } });
    if (accountTemplatesCount > 0) throw new BadRequestException({ code: 'HAS_RELATIONS', message: 'Tài khoản này còn account_type_templates, không thể xóa vĩnh viễn' });

    const markupTemplatesCount = await this.prisma.markupLinkTemplate.count({ where: { ownerId: id } });
    if (markupTemplatesCount > 0) throw new BadRequestException({ code: 'HAS_RELATIONS', message: 'Tài khoản này còn markup_link_templates, không thể xóa vĩnh viễn' });

    const childrenCount = await this.prisma.ibNode.count({ where: { parentId: id } });
    if (childrenCount > 0) throw new BadRequestException({ code: 'HAS_RELATIONS', message: 'Tài khoản này còn tài khoản cấp dưới (ib_nodes), không thể xóa vĩnh viễn' });

    // Delete it
    await this.prisma.ibNode.delete({ where: { id } });

    return { success: true, message: 'Đã xóa vĩnh viễn tài khoản' };
  }
}
