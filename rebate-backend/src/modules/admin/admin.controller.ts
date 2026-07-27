import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { CreateMibDto } from './dto/create-mib.dto';
import { CreateSubIbByAdminDto } from './dto/create-sub-ib-by-admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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

  @Post('ib/mib')
  @ApiOperation({ summary: 'Tạo MIB mới (Admin only)' })
  @ApiResponse({ status: 201, description: 'Tạo MIB thành công' })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại' })
  createMib(@CurrentUser() user: any, @Body() createMibDto: CreateMibDto) {
    return this.adminService.createMib(createMibDto, user.sub);
  }

  @Post('ib/sub')
  @ApiOperation({ summary: 'Admin tạo Sub-IB dưới node cha bất kỳ' })
  @ApiResponse({ status: 201, description: 'Tạo Sub-IB thành công' })
  @ApiResponse({ status: 404, description: 'Node cha không tồn tại' })
  @ApiResponse({ status: 409, description: 'Level đã đạt tối đa hoặc email đã tồn tại' })
  createSubIbByAdmin(@CurrentUser() user: any, @Body() createSubIbByAdminDto: CreateSubIbByAdminDto) {
    return this.adminService.createSubIbByAdmin(createSubIbByAdminDto, user.sub);
  }
}
