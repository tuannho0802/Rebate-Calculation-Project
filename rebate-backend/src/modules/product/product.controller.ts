import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Products')
@ApiBearerAuth('Bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách sản phẩm' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAll(@CurrentUser() user: any, @Query('includeInactive') includeInactive?: string) {
    const isAdmin = user?.role === 'ADMIN';
    const showAll = isAdmin && (includeInactive === 'true' || includeInactive === '1');
    return this.productService.findAll(showAll);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết sản phẩm' })
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin thêm sản phẩm mới' })
  create(@CurrentUser() user: any, @Body() dto: CreateProductDto) {
    return this.productService.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin cập nhật sản phẩm' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin xoá hoặc vô hiệu hoá sản phẩm' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.productService.remove(id, user.sub);
  }
}
