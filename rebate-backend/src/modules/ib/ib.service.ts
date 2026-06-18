import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIbDto } from './dto/create-ib.dto';
import { UpdateIbDto } from './dto/update-ib.dto';
import * as bcrypt from 'bcrypt';
import { AssetType } from '@prisma/client';

@Injectable()
export class IbService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(ibId: string) {
    const user = await this.prisma.ibNode.findUnique({
      where: { id: ibId },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'IB_NOT_FOUND',
        message: 'Không tìm thấy IB',
      });
    }

    const totalChildren = await this.prisma.ibNode.count({
      where: { parentId: ibId },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      level: user.level,
      parentId: user.parentId,
      totalChildren,
      createdAt: user.createdAt,
    };
  }

  async getTree(ibId: string, depth: '1' | 'all') {
    const current = await this.prisma.ibNode.findUnique({
      where: { id: ibId },
    });

    if (!current) {
      throw new NotFoundException({
        code: 'IB_NOT_FOUND',
        message: 'Không tìm thấy IB',
      });
    }

    const allNodes = await this.prisma.ibNode.findMany();
    const map = new Map<string, any>();

    allNodes.forEach((node: any) => {
      map.set(node.id, {
        id: node.id,
        name: node.name,
        email: node.email,
        level: node.level,
        children: [],
      });
    });

    allNodes.forEach((node: any) => {
      if (node.parentId) {
        const parent = map.get(node.parentId);
        if (parent) {
          parent.children.push(map.get(node.id));
        }
      }
    });

    const tree = map.get(ibId);
    if (depth === '1') {
      tree.children = tree.children.map((child: any) => ({
        id: child.id,
        name: child.name,
        email: child.email,
        level: child.level,
        children: [],
      }));
    }

    return tree;
  }

  async getById(id: string) {
    const user = await this.prisma.ibNode.findUnique({
      where: { id },
      include: {
        rebateConfig: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'IB_NOT_FOUND',
        message: 'Không tìm thấy IB',
      });
    }

    const formattedConfig = {
      ibId: user.id,
      assets: user.rebateConfig.map((config: any) => ({
        assetType: config.assetType,
        rebatePips: Number(config.rebatePips),
        markupPips: Number(config.markupPips),
        markupPercent: Number(config.markupPercent),
        maxPips: Number(config.maxPips),
      })),
      updatedAt: user.updatedAt,
    };

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      level: user.level,
      parentId: user.parentId,
      rebateConfig: formattedConfig,
      createdAt: user.createdAt,
    };
  }

  async create(currentUserId: string, currentUserLevel: number, createIbDto: CreateIbDto) {
    if (currentUserLevel >= 5) {
      throw new UnprocessableEntityException({
        code: 'IB_MAX_LEVEL_REACHED',
        message: 'Không thể tạo thêm cấp dưới',
      });
    }

    const existingUser = await this.prisma.ibNode.findUnique({
      where: { email: createIbDto.email },
    });

    if (existingUser) {
      throw new UnprocessableEntityException({
        code: 'IB_EMAIL_TAKEN',
        message: 'Email này đã được sử dụng',
      });
    }

    const hashedPassword = await bcrypt.hash(createIbDto.password, 10);
    const newLevel = currentUserLevel + 1;

    const newIb = await this.prisma.$transaction(async (tx: any) => {
      const ib = await tx.ibNode.create({
        data: {
          email: createIbDto.email,
          name: createIbDto.name,
          password: hashedPassword,
          level: newLevel,
          parentId: currentUserId,
        },
      });

      // Get parent's configurations to set maxPips limit for the child
      const parentConfigs = await tx.rebateConfig.findMany({
        where: { ibId: currentUserId },
      });

      // Initialize child's config for each asset type
      const defaultConfigs = Object.values(AssetType).map((assetType) => {
        const parentConfig = parentConfigs.find((pc: any) => pc.assetType === assetType);
        // Child's max allowed pips is the parent's allocated markupPips
        const maxPips = parentConfig ? Number(parentConfig.markupPips) : 0;

        return {
          ibId: ib.id,
          assetType,
          rebatePips: 0,
          markupPips: 0,
          markupPercent: 100,
          maxPips,
        };
      });

      if (defaultConfigs.length > 0) {
        await tx.rebateConfig.createMany({
          data: defaultConfigs,
        });
      }

      return ib;
    });

    return {
      id: newIb.id,
      name: newIb.name,
      email: newIb.email,
      level: newIb.level,
      parentId: newIb.parentId,
    };
  }

  async updateIb(id: string, dto: UpdateIbDto) {
    if (dto.email) {
      const existing = await this.prisma.ibNode.findUnique({ where: { email: dto.email } });
      if (existing && existing.id !== id) {
        throw new UnprocessableEntityException({
          code: 'IB_EMAIL_TAKEN',
          message: 'Email này đã được sử dụng',
        });
      }
    }

    const updated = await this.prisma.ibNode.update({
      where: { id },
      data: dto,
    });

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      level: updated.level,
      parentId: updated.parentId,
    };
  }

  async deactivateIb(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new UnprocessableEntityException({
        code: 'IB_ACTION_NOT_ALLOWED',
        message: 'Không thể deactivate chính mình',
      });
    }

    const node = await this.prisma.ibNode.findUnique({ where: { id } });
    if (!node) {
      throw new NotFoundException({
        code: 'IB_NOT_FOUND',
        message: 'Không tìm thấy IB',
      });
    }

    if (node.level === 0) {
      throw new UnprocessableEntityException({
        code: 'IB_ACTION_NOT_ALLOWED',
        message: 'Không thể deactivate MIB',
      });
    }

    await this.prisma.ibNode.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'IB đã bị deactivate' };
  }

  async getChildren(id: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.ibNode.findMany({
        where: { parentId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ibNode.count({ where: { parentId: id } }),
    ]);

    return {
      data: data.map((child: any) => ({
        id: child.id,
        name: child.name,
        email: child.email,
        level: child.level,
        isActive: child.isActive,
        createdAt: child.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
