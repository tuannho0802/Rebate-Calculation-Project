import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { IbService } from './ib.service';
import { CreateIbDto } from './dto/create-ib.dto';
import { UpdateIbDto } from './dto/update-ib.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubtreeGuard } from '../../common/guards/subtree.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';

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

  @ApiOperation({
    summary: 'Xem chi tiết một IB theo ID',
    description:
      'Trả về thông tin chi tiết của một IB bất kỳ trong cây của bạn.\n\n' +
      '**Lưu ý:** Chỉ cho phép xem các IB thuộc subtree của bạn (kiểm tra bằng SubtreeGuard).',
  })
  @ApiParam({ name: 'id', description: 'UUID của IB cần xem', example: 'clxyz123' })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin IB thành công',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          email: 'string',
          name: 'string',
          level: 3,
          isActive: true,
          parentId: 'uuid',
          rebateConfig: {
            ibId: 'uuid',
            assets: [{ assetType: 'FOREX', rebatePips: 2.0, markupPips: 8.0, markupPercent: 100.0, maxPips: 12.0 }],
            updatedAt: '2024-01-01T00:00:00Z'
          },
          createdAt: '2024-01-01T00:00:00Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 403,
    description: 'Bị từ chối — IB không thuộc subtree của bạn',
    schema: { example: { success: false, error: { code: 'IB_NOT_IN_SUBTREE', message: 'Bạn không có quyền xem thông tin IB này' } } }
  })
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
      '**Payload mẫu:**\n' +
      '```json\n' +
      '{\n' +
      '  "email": "new-ib@example.com",\n' +
      '  "password": "Test@1234",\n' +
      '  "name": "Nguyen Van A"\n' +
      '}\n' +
      '```\n\n' +
      '*Lưu ý: Sub-IB sẽ được gán level = level của bạn + 1 và parentId = ID của bạn tự động.*',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo Sub-IB thành công',
    schema: {
      example: {
        success: true,
        data: { id: 'uuid', email: 'new-ib@example.com', name: 'Nguyen Van A', level: 2, parentId: 'uuid' }
      }
    }
  })
  @ApiResponse({
    status: 422,
    description: 'Email đã tồn tại hoặc dữ liệu không hợp lệ',
    schema: { example: { success: false, error: { code: 'IB_EMAIL_TAKEN', message: 'Email này đã được sử dụng' } } }
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: any,
    @Body() createIbDto: CreateIbDto,
  ) {
    return this.ibService.create(user.sub, user.level, createIbDto);
  }

  @Put(':id')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({
    summary: 'Cập nhật thông tin Sub-IB',
    description:
      'Cập nhật `name` hoặc `email` của một IB trong subtree của bạn.\n\n' +
      '**Payload mẫu:**\n' +
      '```json\n' +
      '{\n' +
      '  "name": "Tên mới",\n' +
      '  "email": "email-moi@example.com"\n' +
      '}\n' +
      '```\n\n' +
      '*Tất cả trường đều không bắt buộc — chỉ gửi trường cần thay đổi.*',
  })
  @ApiParam({ name: 'id', description: 'UUID của IB cần cập nhật', example: 'uuid-here' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 403, description: 'Bị từ chối — IB không thuộc subtree của bạn' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy IB' })
  @ApiResponse({ status: 422, description: 'Email đã tồn tại hoặc dữ liệu không hợp lệ' })
  updateIb(@Param('id') id: string, @Body() dto: UpdateIbDto) {
    return this.ibService.updateIb(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({
    summary: 'Vô hiệu hóa Sub-IB (soft delete)',
    description:
      'Đánh dấu IB là không hoạt động (`isActive = false`). **Không xóa khỏi database.**\n\n' +
      'IB bị vô hiệu hóa sẽ không thể đăng nhập nhưng dữ liệu lịch sử vẫn được giữ nguyên.',
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
    description:
      'Trả về danh sách các IB con trực tiếp của IB được chỉ định, hỗ trợ phân trang.\n\n' +
      'Ví dụ: `GET /api/ib/{id}/children?page=1&limit=10`',
  })
  @ApiParam({ name: 'id', description: 'UUID của IB cha cần xem danh sách con', example: 'uuid-here' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Trang hiện tại (mặc định: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số bản ghi mỗi trang (mặc định: 20)', example: 20 })
  @ApiResponse({ status: 200, description: 'Danh sách trả về thành công' })
  @ApiResponse({ status: 403, description: 'Bị từ chối — IB không thuộc subtree của bạn' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy IB' })
  getChildren(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.ibService.getChildren(id, +page, +limit);
  }
}
