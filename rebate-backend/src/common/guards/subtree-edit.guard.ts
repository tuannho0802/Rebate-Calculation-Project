import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * SubtreeEditGuard — dùng cho các hành động GHI (deactivate, reset-password,
 * update config, update templates...), LUÔN strict "chỉ cha trực tiếp",
 * KHÔNG có ngoại lệ cho MIB (Lv0).
 *
 * Khác với SubtreeGuard (dùng cho route VIEW, có ngoại lệ cho MIB xem đệ quy
 * toàn bộ nhánh của mình) — quy tắc nghiệp vụ là: MIB chỉ được "View ALL"
 * trong nhánh của mình, KHÔNG được "Edit ALL". Mọi hành động sửa/xoá vẫn
 * phải tuân thủ parent-strict: chỉ cha trực tiếp mới sửa được con trực tiếp.
 *
 * Guard order khuyến nghị: @UseGuards(JwtAuthGuard, SubtreeEditGuard)
 * (kết hợp thêm ProtectRootAdminGuard/Lv0Guard nếu route cần).
 */
@Injectable()
export class SubtreeEditGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) return false;

        // ADMIN: CRUD ALL — luôn được phép.
        if (user.role === 'ADMIN') return true;

        const targetIbId = request.params.id || request.params.ibId || request.query.ibId;
        if (!targetIbId) {
            throw new ForbiddenException({
                code: 'SUBTREE_TARGET_UNRESOLVED',
                message: 'Không xác định được đối tượng cần kiểm tra quyền truy cập',
            });
        }

        // Parent strict: kể cả MIB cũng chỉ được sửa CON TRỰC TIẾP, không đệ quy.
        const target = await this.prisma.ibNode.findUnique({
            where: { id: targetIbId },
            select: { parentId: true },
        });

        if (target?.parentId !== user.sub) {
            throw new ForbiddenException({
                code: 'IB_NOT_DIRECT_CHILD',
                message: 'Bạn chỉ có quyền thực hiện hành động này với cấp dưới trực tiếp của mình',
            });
        }

        return true;
    }
}