import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProtectRootAdminGuard } from '../../common/guards/protect-root-admin.guard';

@ApiTags('Admin Users')
@ApiBearerAuth('Bearer')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo Admin mới' })
  create(@Body() createAdminDto: CreateAdminDto) {
    return this.adminService.createAdmin(createAdminDto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách Admin' })
  findAll() {
    return this.adminService.findAllAdmins();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật Admin' })
  update(@Param('id') id: string, @Body() updateAdminDto: UpdateAdminDto) {
    return this.adminService.updateAdmin(id, updateAdminDto);
  }

  @Delete(':id')
  @UseGuards(ProtectRootAdminGuard)
  @ApiOperation({ summary: 'Khóa (soft delete) Admin' })
  remove(@Param('id') id: string) {
    return this.adminService.softDeleteAdmin(id);
  }
}
