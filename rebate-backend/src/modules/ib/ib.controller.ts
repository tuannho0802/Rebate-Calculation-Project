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

  @ApiOperation({ summary: 'Get profile information of the currently logged-in IB' })
  @ApiResponse({
    status: 200,
    description: 'Profile information retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          email: 'ib@example.com',
          level: 2,
          parentId: 'uuid',
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

  @ApiOperation({ summary: 'Get direct or recursive child subtree hierarchy' })
  @ApiQuery({ name: 'depth', required: false, enum: ['1', 'all'], description: '1 for direct children, all for complete subtree' })
  @ApiResponse({
    status: 200,
    description: 'Tree data successfully retrieved',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          email: 'ib@example.com',
          level: 1,
          children: [
            {
              id: 'uuid',
              email: 'child-ib@example.com',
              level: 2,
              children: []
            }
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

  @ApiOperation({ summary: 'Get details of a specific IB (restricted to descendants in your subtree)' })
  @ApiParam({ name: 'id', description: 'The UUID of the target IB node' })
  @ApiResponse({
    status: 200,
    description: 'IB details retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          email: 'string',
          level: 3,
          parentId: 'uuid',
          rebateConfig: {
            ibId: 'uuid',
            assets: [
              {
                assetType: 'FOREX',
                rebatePips: 2.0,
                markupPips: 8.0,
                markupPercent: 100.0,
                maxPips: 12.0
              }
            ],
            updatedAt: '2024-01-01T00:00:00Z'
          },
          createdAt: '2024-01-01T00:00:00Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Target IB is not in your subtree',
    schema: {
      example: {
        success: false,
        error: {
          code: 'IB_NOT_IN_SUBTREE',
          message: 'Bạn không có quyền xem thông tin IB này'
        }
      }
    }
  })
  @Get(':id')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  async getById(@Param('id') id: string) {
    return this.ibService.getById(id);
  }

  @ApiOperation({ summary: 'Create a direct sub-IB node under the current user' })
  @ApiResponse({
    status: 21,
    description: 'Sub-IB created successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          email: 'new-ib@example.com',
          level: 2,
          parentId: 'uuid'
        }
      }
    }
  })
  @ApiResponse({
    status: 422,
    description: 'Validation failed or email already taken',
    schema: {
      example: {
        success: false,
        error: {
          code: 'IB_EMAIL_TAKEN',
          message: 'Email này đã được sử dụng'
        }
      }
    }
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
  @ApiOperation({ summary: 'Cập nhật thông tin Sub-IB (chỉ được sửa IB cấp dưới của mình)' })
  @ApiParam({ name: 'id', description: 'UUID của IB', example: 'uuid-here' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — không phải subtree' })
  @ApiResponse({ status: 404, description: 'IB không tồn tại' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  updateIb(@Param('id') id: string, @Body() dto: UpdateIbDto) {
    return this.ibService.updateIb(id, dto);
  }
  @Delete(':id')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({ summary: 'Deactivate Sub-IB (soft delete — không xóa khỏi DB)' })
  @ApiParam({ name: 'id', description: 'UUID của IB', example: 'uuid-here' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — không phải subtree' })
  @ApiResponse({ status: 404, description: 'IB không tồn tại' })
  deactivateIb(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ibService.deactivateIb(id, user.sub);
  }

  @Get(':id/children')
  @ApiBearerAuth('Bearer')
  @UseGuards(SubtreeGuard)
  @ApiOperation({ summary: 'Danh sách Sub-IB trực tiếp của một IB (có phân trang)' })
  @ApiParam({ name: 'id', description: 'UUID của IB', example: 'uuid-here' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — không phải subtree' })
  @ApiResponse({ status: 404, description: 'IB không tồn tại' })
  getChildren(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.ibService.getChildren(id, +page, +limit);
  }
}
