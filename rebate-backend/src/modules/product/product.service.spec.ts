import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('ProductService', () => {
  let service: ProductService;
  let prisma: any;
  let auditService: any;

  const mockProduct = {
    id: 'prod-1',
    symbol: 'GOLD_TEST',
    name: 'Gold Test',
    category: 'Metals',
    defaultMax: 25,
    calcUnit: 'pips',
    order: 1,
    isActive: true,
    allowMarkup: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([mockProduct]),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue(mockProduct),
        update: jest.fn().mockResolvedValue(mockProduct),
        delete: jest.fn().mockResolvedValue(mockProduct),
        count: jest.fn().mockResolvedValue(1),
      },
      rebateConfig: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      rebateTransaction: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    auditService = {
      log: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return active products by default', async () => {
      const res = await service.findAll();
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ order: 'asc' }, { symbol: 'asc' }],
      });
    });

    it('should return all products including inactive when requested', async () => {
      await service.findAll(true);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ order: 'asc' }, { symbol: 'asc' }],
      });
    });
  });

  describe('create', () => {
    it('should create product when symbol is unique', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      const res = await service.create(
        { symbol: 'SILVER_TEST', name: 'Silver Test', defaultMax: 50 },
        'admin-id',
      );
      expect(res.success).toBe(true);
      expect(prisma.product.create).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should throw ConflictException if symbol already exists', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      await expect(
        service.create({ symbol: 'GOLD_TEST', name: 'Gold Test', defaultMax: 20 }, 'admin-id'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update product fields', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      const res = await service.update('prod-1', { defaultMax: 30 }, 'admin-id');
      expect(res.success).toBe(true);
      expect(prisma.product.update).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(
        service.update('not-exist', { defaultMax: 30 }, 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should permanently delete product if no transactions/configs exist', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.rebateConfig.count.mockResolvedValue(0);
      prisma.rebateTransaction.count.mockResolvedValue(0);

      const res = await service.remove('prod-1', 'admin-id');
      expect(res.success).toBe(true);
      expect(res.data.deleted).toBe(true);
      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'prod-1' } });
    });

    it('should soft-delete (isActive=false) product if transactions/configs exist', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.rebateTransaction.count.mockResolvedValue(5);

      const res = await service.remove('prod-1', 'admin-id');
      expect(res.success).toBe(true);
      expect(res.data.isActive).toBe(false);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { isActive: false },
      });
    });
  });
});
