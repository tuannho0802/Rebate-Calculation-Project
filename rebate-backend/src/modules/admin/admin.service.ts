import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async createAdmin(dto: CreateAdminDto) {
    const existing = await this.prisma.ibNode.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Email này đã được sử dụng',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const admin = await this.prisma.ibNode.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: 'ADMIN',
        level: 0,
        parentId: null,
      },
    });

    const { password, ...result } = admin;
    return result;
  }

  async findAllAdmins() {
    return this.prisma.ibNode.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        isRootAdmin: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAdmin(id: string, dto: UpdateAdminDto) {
    const target = await this.prisma.ibNode.findUnique({ where: { id } });
    if (!target || target.role !== 'ADMIN') {
      throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Không tìm thấy Admin',
      });
    }

    if (dto.email && dto.email !== target.email) {
      const existing = await this.prisma.ibNode.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Email này đã được sử dụng',
        });
      }
    }

    const dataToUpdate: any = {};
    if (dto.email) dataToUpdate.email = dto.email;
    if (dto.name) dataToUpdate.name = dto.name;
    if (dto.password) {
      dataToUpdate.password = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.ibNode.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        isRootAdmin: true,
        isActive: true,
        updatedAt: true,
      },
    });
    return updated;
  }

  async softDeleteAdmin(id: string) {
    const target = await this.prisma.ibNode.findUnique({ where: { id } });
    if (!target || target.role !== 'ADMIN') {
      throw new NotFoundException({
        code: 'ADMIN_NOT_FOUND',
        message: 'Không tìm thấy Admin',
      });
    }

    await this.prisma.ibNode.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true, message: 'Đã khóa Admin' };
  }
}
