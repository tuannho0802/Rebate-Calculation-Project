import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    const products = await this.prisma.product.findMany({
      where,
      orderBy: [{ order: 'asc' }, { symbol: 'asc' }],
    });

    return {
      success: true,
      data: products.map((p) => ({
        id: p.id,
        symbol: p.symbol,
        name: p.name,
        category: p.category,
        defaultMax: Number(p.defaultMax),
        calcUnit: p.calcUnit,
        order: p.order,
        isActive: p.isActive,
        allowMarkup: p.allowMarkup ?? true,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Sản phẩm với ID ${id} không tồn tại`);
    }
    return {
      id: product.id,
      symbol: product.symbol,
      name: product.name,
      category: product.category,
      defaultMax: Number(product.defaultMax),
      calcUnit: product.calcUnit,
      order: product.order,
      isActive: product.isActive,
      allowMarkup: product.allowMarkup ?? true,
    };
  }

  async create(dto: CreateProductDto, actorId: string) {
    const normalizedSymbol = dto.symbol.trim().toUpperCase();

    const existing = await this.prisma.product.findUnique({
      where: { symbol: normalizedSymbol },
    });

    if (existing) {
      throw new ConflictException(`Mã sản phẩm ${normalizedSymbol} đã tồn tại trong hệ thống`);
    }

    const count = await this.prisma.product.count();
    const order = dto.order !== undefined ? dto.order : count + 1;

    const product = await this.prisma.product.create({
      data: {
        symbol: normalizedSymbol,
        name: dto.name.trim(),
        category: dto.category?.trim() || 'General',
        defaultMax: dto.defaultMax,
        calcUnit: dto.calcUnit?.trim() || 'pips',
        order,
        isActive: true,
        allowMarkup: dto.allowMarkup !== undefined ? dto.allowMarkup : true,
      },
    });

    await this.auditService.log({
      actorId,
      action: AUDIT_ACTIONS.PRODUCT_CREATE,
      targetType: 'PRODUCT',
      targetId: product.id,
      before: undefined,
      after: {
        symbol: product.symbol,
        name: product.name,
        defaultMax: Number(product.defaultMax),
        calcUnit: product.calcUnit,
        allowMarkup: product.allowMarkup,
      },
    });

    return {
      success: true,
      message: `Tạo sản phẩm ${product.symbol} thành công`,
      data: {
        id: product.id,
        symbol: product.symbol,
        name: product.name,
        category: product.category,
        defaultMax: Number(product.defaultMax),
        calcUnit: product.calcUnit,
        order: product.order,
        isActive: product.isActive,
        allowMarkup: product.allowMarkup,
      },
    };
  }

  async update(id: string, dto: UpdateProductDto, actorId: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Sản phẩm với ID ${id} không tồn tại`);
    }

    const data: any = {};
    if (dto.symbol !== undefined) {
      const normalizedSymbol = dto.symbol.trim().toUpperCase();
      if (normalizedSymbol !== product.symbol) {
        const symbolExists = await this.prisma.product.findUnique({
          where: { symbol: normalizedSymbol },
        });
        if (symbolExists) {
          throw new ConflictException(`Mã sản phẩm ${normalizedSymbol} đã tồn tại`);
        }
        data.symbol = normalizedSymbol;
      }
    }

    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.category !== undefined) data.category = dto.category.trim();
    if (dto.defaultMax !== undefined) data.defaultMax = dto.defaultMax;
    if (dto.calcUnit !== undefined) data.calcUnit = dto.calcUnit.trim();
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.allowMarkup !== undefined) data.allowMarkup = dto.allowMarkup;

    const updated = await this.prisma.product.update({
      where: { id },
      data,
    });

    // Nếu đổi symbol, đồng bộ sang rebate_configs và rebate_transactions
    if (data.symbol && data.symbol !== product.symbol) {
      await this.prisma.rebateConfig.updateMany({
        where: { assetType: product.symbol },
        data: { assetType: data.symbol },
      });
      await this.prisma.rebateTransaction.updateMany({
        where: { assetType: product.symbol },
        data: { assetType: data.symbol },
      });
    }

    await this.auditService.log({
      actorId,
      action: AUDIT_ACTIONS.PRODUCT_UPDATE,
      targetType: 'PRODUCT',
      targetId: id,
      before: {
        symbol: product.symbol,
        name: product.name,
        defaultMax: Number(product.defaultMax),
        isActive: product.isActive,
        allowMarkup: product.allowMarkup,
      },
      after: {
        symbol: updated.symbol,
        name: updated.name,
        defaultMax: Number(updated.defaultMax),
        isActive: updated.isActive,
        allowMarkup: updated.allowMarkup,
      },
    });

    return {
      success: true,
      message: `Cập nhật sản phẩm ${updated.symbol} thành công`,
      data: {
        id: updated.id,
        symbol: updated.symbol,
        name: updated.name,
        category: updated.category,
        defaultMax: Number(updated.defaultMax),
        calcUnit: updated.calcUnit,
        order: updated.order,
        isActive: updated.isActive,
        allowMarkup: updated.allowMarkup,
      },
    };
  }

  async remove(id: string, actorId: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Sản phẩm với ID ${id} không tồn tại`);
    }

    // Kiểm tra xem sản phẩm đã có giao dịch hoặc cấu hình chưa
    const [txCount, configCount] = await Promise.all([
      this.prisma.rebateTransaction.count({ where: { assetType: product.symbol } }),
      this.prisma.rebateConfig.count({ where: { assetType: product.symbol } }),
    ]);

    if (txCount > 0 || configCount > 0) {
      // Đã có dữ liệu lịch sử liên quan -> An toàn chuyển sang isActive = false (vô hiệu hoá)
      const updated = await this.prisma.product.update({
        where: { id },
        data: { isActive: false },
      });

      await this.auditService.log({
        actorId,
        action: AUDIT_ACTIONS.PRODUCT_DELETE,
        targetType: 'PRODUCT',
        targetId: id,
        before: { symbol: product.symbol, isActive: product.isActive },
        after: { symbol: product.symbol, isActive: false, softDeleted: true },
      });

      return {
        success: true,
        message: `Sản phẩm ${product.symbol} đã có dữ liệu giao dịch/cấu hình liên quan nên được chuyển sang trạng thái Khoá/Ẩn để bảo toàn lịch sử.`,
        data: { id, symbol: product.symbol, isActive: false },
      };
    }

    // Chưa có dữ liệu liên quan -> Xoá hẳn
    await this.prisma.product.delete({ where: { id } });

    await this.auditService.log({
      actorId,
      action: AUDIT_ACTIONS.PRODUCT_DELETE,
      targetType: 'PRODUCT',
      targetId: id,
      before: { symbol: product.symbol, name: product.name },
      after: undefined,
    });

    return {
      success: true,
      message: `Đã xoá hoàn toàn sản phẩm ${product.symbol}`,
      data: { id, symbol: product.symbol, deleted: true },
    };
  }
}
