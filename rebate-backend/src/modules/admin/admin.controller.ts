import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProtectRootAdminGuard } from '../../common/guards/protect-root-admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Admin Users')
@ApiBearerAuth('Bearer')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo Admin mới' })
  create(@CurrentUser() user: any, @Body() createAdminDto: CreateAdminDto) {
    return this.adminService.createAdmin(createAdminDto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách Admin' })
  findAll() {
    return this.adminService.findAllAdmins();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật Admin' })
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() updateAdminDto: UpdateAdminDto) {
    return this.adminService.updateAdmin(id, updateAdminDto, user.sub);
  }

  @Delete(':id')
  @UseGuards(ProtectRootAdminGuard)
  @ApiOperation({ summary: 'Khóa (soft delete) Admin' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.softDeleteAdmin(id, user.sub);
  }
}
