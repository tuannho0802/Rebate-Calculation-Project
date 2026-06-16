import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIbDto } from './dto/create-ib.dto';
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
      email: newIb.email,
      level: newIb.level,
      parentId: newIb.parentId,
    };
  }
}
