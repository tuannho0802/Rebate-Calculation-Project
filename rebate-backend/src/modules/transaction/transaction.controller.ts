import {
  Controller, Post, Get, Delete, Param, Body,
  UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiParam,
  ApiTags, ApiBody,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateBatchTransactionDto } from './dto/create-batch-transaction.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('Bearer')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo 1 giao dịch cho IB trong subtree của mình' })
  @ApiBody({ type: CreateTransactionDto })
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateTransactionDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.transactionService.create(user.sub, dto, ip);
  }

  // QUAN TRỌNG: route /batch phải đặt TRƯỚC /:id để tránh conflict
  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo nhiều giao dịch cùng lúc (tối đa 500)' })
  @ApiBody({ type: CreateBatchTransactionDto })
  createBatch(
    @CurrentUser() user: any,
    @Body() dto: CreateBatchTransactionDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.transactionService.createBatch(user.sub, dto, ip);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết 1 giao dịch' })
  @ApiParam({ name: 'id', description: 'UUID của giao dịch' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.transactionService.findOne(user.sub, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa giao dịch (chỉ người tạo hoặc MIB)' })
  @ApiParam({ name: 'id', description: 'UUID của giao dịch' })
  remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.transactionService.remove(user.sub, id, ip);
  }
}
