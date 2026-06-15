import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { ProductsService } from '../products/products.service';
import { Order, OrderStatus } from './entities/order.entity';
import { UserRole } from '../users/entities/user.entity';

describe('OrdersService', () => {
  let service: OrdersService;
  let repo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let productsService: { findById: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };
    productsService = { findById: jest.fn(), save: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: repo },
        { provide: ProductsService, useValue: productsService },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('create', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      productsService.findById.mockResolvedValue(null);

      await expect(
        service.create(1, { productId: 99, quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when stock is insufficient', async () => {
      productsService.findById.mockResolvedValue({
        id: 1,
        name: 'Mouse',
        price: 25,
        stock: 1,
      });

      await expect(
        service.create(1, { productId: 1, quantity: 2 }),
      ).rejects.toThrow(BadRequestException);
      expect(productsService.save).not.toHaveBeenCalled();
    });

    it('decrements stock and creates a pending order with the computed total', async () => {
      const product = { id: 1, name: 'Mouse', price: 25, stock: 5 };
      productsService.findById.mockResolvedValue(product);
      productsService.save.mockResolvedValue(product);
      repo.create.mockImplementation((data) => data);
      repo.save.mockImplementation(async (data) => ({ id: 10, ...data }));

      const result = await service.create(7, { productId: 1, quantity: 2 });

      expect(product.stock).toBe(3);
      expect(productsService.save).toHaveBeenCalledWith(product);
      expect(repo.create).toHaveBeenCalledWith({
        productId: 1,
        quantity: 2,
        total: 50,
        status: OrderStatus.PENDING,
        userId: 7,
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: 10,
          total: 50,
          status: OrderStatus.PENDING,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the order does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(1, {
          userId: 1,
          email: 'a@example.com',
          role: UserRole.USER,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when accessed by a different non-admin user', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        userId: 2,
        status: OrderStatus.PENDING,
      });

      await expect(
        service.findOne(1, {
          userId: 1,
          email: 'a@example.com',
          role: UserRole.USER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows the owner to access their order', async () => {
      const order = { id: 1, userId: 1, status: OrderStatus.PENDING };
      repo.findOne.mockResolvedValue(order);

      const result = await service.findOne(1, {
        userId: 1,
        email: 'a@example.com',
        role: UserRole.USER,
      });

      expect(result).toBe(order);
    });

    it('allows an admin to access any order', async () => {
      const order = { id: 1, userId: 2, status: OrderStatus.PENDING };
      repo.findOne.mockResolvedValue(order);

      const result = await service.findOne(1, {
        userId: 99,
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      });

      expect(result).toBe(order);
    });
  });

  describe('updateStatus', () => {
    const user = { userId: 1, email: 'a@example.com', role: UserRole.USER };

    it.each([
      [OrderStatus.PENDING, OrderStatus.CONFIRMED],
      [OrderStatus.PENDING, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED, OrderStatus.DELIVERED],
      [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    ])('allows transitioning from %s to %s', async (from, to) => {
      const order = { id: 1, userId: 1, status: from };
      repo.findOne.mockResolvedValue(order);
      repo.save.mockImplementation(async (data) => data);

      const result = await service.updateStatus(1, { status: to }, user);

      expect(result.status).toBe(to);
    });

    it.each([
      [OrderStatus.PENDING, OrderStatus.DELIVERED],
      [OrderStatus.CONFIRMED, OrderStatus.PENDING],
      [OrderStatus.DELIVERED, OrderStatus.CONFIRMED],
      [OrderStatus.CANCELLED, OrderStatus.CONFIRMED],
    ])('rejects transitioning from %s to %s', async (from, to) => {
      const order = { id: 1, userId: 1, status: from };
      repo.findOne.mockResolvedValue(order);

      await expect(
        service.updateStatus(1, { status: to }, user),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
