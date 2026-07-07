import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, UseGuards, Req,
  HttpStatus, HttpCode,
} from '@nestjs/common';
import type { Request } from 'express';
import { IbService } from './ib.service';
import { CreateIbDto } from './dto/create-ib.dto';
import { UpdateIbDto } from './dto/update-ib.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubtreeGuard } from '../../common/guards/subtree.guard';
import { Lv0Guard } from '../../common/guards/lv0.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
  ApiQuery, ApiParam,
} from '@nestjs/swagger';

@ApiTags('🌳 IB Management')
@ApiBearerAuth('Bearer')
@Controller('ib')
@UseGuards(JwtAuthGuard)
export class IbController {
  constructor(private readonly ibService: IbService) {}

  @ApiOperation({
    summary: 'Xem thông tin IB đang đăng nhập',
    description: 'Trả về thông tin chi tiết của IB hiện tại dựa trên JWT token. Không cần tham số.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin thành công',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          email: 'ib@example.com',
          name: 'Nguyen Van A',
          level: 2,
          parentId: 'uuid',
          isActive: true,
          totalChildren: 5,
          createdAt: '2024-01-01T00:00:00Z'
        }
      }
    }
  })
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return this.ibService.getMe(user.sub);
  }

  @ApiOperation({
    summary: 'Xem cây IB trực tiếp hoặc toàn bộ',
    description:
      'Trả về cây phân cấp IB bên dưới người dùng hiện tại.\n\n' +
      '- `depth=1` (mặc định): chỉ lấy các IB con trực tiếp.\n' +
      '- `depth=all`: lấy toàn bộ cây đệ quy xuống tận cùng.',
  })
  @ApiQuery({
    name: 'depth',
    required: false,
    enum: ['1', 'all'],
    description: '`1` = chỉ con trực tiếp | `all` = toàn bộ cây (đệ quy)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cây IB trả về thành công',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          email: 'ib@example.com',
          level: 1,
          children: [
            { id: 'uuid', email: 'child@example.com', level: 2, children: [] }
          ]
        }
      }
    }
  })
  @Get('tree')
  async getTree(
    @CurrentUser() user: any,
    @Query('depth') depth: '1' | 'all' = '1',
  ) {
    return this.ibService.getTree(user.sub, depth);
  }

  // ─── LEADERBOARD — phải đặt TRƯỜC GET :id ─────────────────────────────────────
  @Get('leaderboard')
  @ApiOperation({ summary: 'Top IB trong subtree theo lots tháng này' })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 10, description: 'Số IB top (tối đa 50)' })
  getLeaderboard(
    @CurrentUser() user: any,
    @Query('limit') limit = '10',
  ) {
    return this.ibService.getLeaderboard(user.sub, Math.min(parseInt(limit, 10) || 10, 50));
  }

  // ─── SEARCH — phải đặt TRƯỚC GET :id ─────────────────────────────────────────
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm IB theo email hoặc tên trong subtree của mình' })
  @ApiQuery({ name: 'q', required: true, description: 'Từ khóa tìm kiếm (ít nhất 2 ký tự)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean, default: false, description: 'Bao gồm IB đã bị deactivate' })
  @ApiQuery({ name: 'page', required: false, type: Number, default: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 20 })
  searchIb(
    @CurrentUser() user: any,
    @Query('q') q: string | undefined,
    @Query('includeInactive') includeInactive?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.ibService.searchIb(
      user.sub,
      q,
      includeInactive === 'true',
      parseInt(page, 10) || 1,
      Math.min(parseInt(limit, 10) || 20, 100),
    );
  }

  @ApiOperation({
    summary: 'Xem chi tiết một IB theo ID',
    description:
      'Trả về thông tin chi tiết của một IB bất kỳ trong cây của bạn.\n\n' +
      '**Lưu ý:** Chỉ cho phép xem các IB thuộc subtree của bạn (kiểm tra bằng SubtreeGuard).',
  })
  @ApiParam({ name: 'id', description: 'UUID của IB cần xem', example: 'clxyz123' })
  @ApiResponse({ status: 200, description: 'Lấy thông tin IB thành công' })
  @ApiResponse({ status: 403, description: 'Bị từ chối — IB không thuộc subtree của bạn' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy IB với ID đã cung cấp' })
  @Get(':id')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  async getById(@Param('id') id: string) {
    return this.ibService.getById(id);
  }

  @ApiOperation({
    summary: 'Tạo Sub-IB trực tiếp bên dưới bạn',
    description:
      'Tạo một IB con trực thuộc người dùng hiện tại.\n\n' +
      '*Sub-IB sẽ được gán level = level của bạn + 1 và parentId = ID của bạn tự động.*',
  })
  @ApiResponse({ status: 201, description: 'Tạo Sub-IB thành công' })
  @ApiResponse({ status: 422, description: 'Email đã tồn tại hoặc dữ liệu không hợp lệ' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: any,
    @Body() createIbDto: CreateIbDto,
  ) {
    return this.ibService.create(user.sub, user.level, createIbDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin cơ bản IB' })
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateIbDto) {
    return this.ibService.updateIb(id, dto, user.sub);
  }

  @Get(':id/profile')
  @ApiOperation({ summary: 'Xem profile đầy đủ của IB' })
  getProfile(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ibService.getProfile(user.sub, user.level, id);
  }

  @Patch(':id/profile')
  @ApiOperation({ summary: 'Cập nhật profile IB' })
  updateProfile(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateIbDto) {
    return this.ibService.updateProfile(user.sub, user.level, id, dto);
  }

  @Patch(':id/reset-password')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({
    summary: 'Cập nhật thông tin Sub-IB',
    description: 'Cập nhật `name` hoặc `email` của một IB trong subtree của bạn.',
  })
  @ApiParam({ name: 'id', description: 'UUID của IB cần cập nhật', example: 'uuid-here' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 403, description: 'Bị từ chối — IB không thuộc subtree của bạn' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy IB' })
  @ApiResponse({ status: 422, description: 'Email đã tồn tại hoặc dữ liệu không hợp lệ' })
  updateIb(
    @Param('id') id: string,
    @Body() dto: UpdateIbDto,
    @CurrentUser() user: any,
  ) {
    return this.ibService.updateIb(id, dto, user.sub);
  }

  @Delete(':id')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({
    summary: 'Vô hiệu hóa Sub-IB (soft delete)',
    description: 'Đánh dấu IB là không hoạt động (`isActive = false`). **Không xóa khỏi database.**',
  })
  @ApiParam({ name: 'id', description: 'UUID của IB cần vô hiệu hóa', example: 'uuid-here' })
  @ApiResponse({ status: 200, description: 'Vô hiệu hóa thành công' })
  @ApiResponse({ status: 403, description: 'Bị từ chối — IB không thuộc subtree của bạn' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy IB' })
  deactivateIb(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ibService.deactivateIb(id, user.sub);
  }

  @Get(':id/children')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({
    summary: 'Danh sách Sub-IB trực tiếp của một IB (có phân trang)',
    description: 'Trả về danh sách các IB con trực tiếp của IB được chỉ định, hỗ trợ phân trang.',
  })
  @ApiParam({ name: 'id', description: 'UUID của IB cha cần xem danh sách con', example: 'uuid-here' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Trang hiện tại (mặc định: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số bản ghi mỗi trang (mặc định: 20)', example: 20 })
  @ApiResponse({ status: 200, description: 'Danh sách trả về thành công' })
  @ApiResponse({ status: 403, description: 'Bị từ chối — IB không thuộc subtree của bạn' })
  getChildren(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.ibService.getChildren(id, +page, +limit);
  }

  // ─── RESTORE — đặt SAU các route GET ─────────────────────────────────────────
  @Patch(':id/restore')
  @UseGuards(SubtreeGuard)
  @ApiBearerAuth('Bearer')
  @ApiOperation({ summary: 'Khôi phục IB đã bị vô hiệu hóa' })
  @ApiParam({ name: 'id', description: 'UUID của IB cần khôi phục' })
  @ApiResponse({ status: 200, description: 'Khôi phục thành công' })
  @ApiResponse({ status: 422, description: 'IB đang active, không cần khôi phục' })
  restoreIb(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.ibService.restoreIb(id, user.sub, ip);
  }

  // ─── PERFORMANCE ─────────────────────────────────────────────────────
  @Get(':id/performance')
  @ApiOperation({ summary: 'Hiệu suất của một IB theo tháng (bao gồm downline)' })
  @ApiParam({ name: 'id', description: 'UUID of IB' })
  @ApiQuery({ name: 'month', required: false, description: 'Tháng theo định dạng YYYY-MM, mặc định là tháng hiện tại', example: '2026-06' })
  getIbPerformance(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('month') month?: string,
  ) {
    return this.ibService.getIbPerformance(user.sub, id, month);
  }

  // ─── RESET PASSWORD (Lv0 only) ──────────────────────────────────
  @Patch(':id/reset-password')
  @UseGuards(Lv0Guard, SubtreeGuard)
  @ApiOperation({
    summary: 'Reset mật khẩu cho Sub-IB (chỉ Lv0)',
    description:
      'Cho phép MIB (Lv0) reset mật khẩu của bất kỳ IB nào trong cây.\n\n' +
      '**SubtreeGuard** vẫn được áp dụng — bảo vệ cross-tree (hệ thống nhiều MIB độc lập).\n' +
      '**Lv0Guard** chặn Lv1+ trước khi đến SubtreeGuard.',
  })
  @ApiParam({ name: 'id', description: 'UUID của IB cần reset mật khẩu' })
  @ApiResponse({ status: 200, description: 'Reset mật khẩu thành công' })
  @ApiResponse({ status: 403, description: 'Chỉ Lv0 mới được thực hiện' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy IB' })
  resetPassword(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.ibService.resetPassword(user.sub, id, dto.newPassword);
  }
}
