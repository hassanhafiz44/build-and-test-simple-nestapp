import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from '../products/products.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UserRole } from '../users/entities/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order, OrderStatus } from './entities/order.entity';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly productsService: ProductsService,
  ) {}

  async create(userId: number, dto: CreateOrderDto): Promise<Order> {
    const product = await this.productsService.findById(dto.productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.stock < dto.quantity) {
      throw new BadRequestException('Insufficient stock for this product');
    }

    product.stock -= dto.quantity;
    await this.productsService.save(product);

    const order = this.ordersRepository.create({
      productId: product.id,
      quantity: dto.quantity,
      total: product.price * dto.quantity,
      status: OrderStatus.PENDING,
      userId,
    });

    return this.ordersRepository.save(order);
  }

  async findOne(id: number, user: AuthenticatedUser): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== user.userId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }

  async updateStatus(
    id: number,
    dto: UpdateOrderStatusDto,
    user: AuthenticatedUser,
  ): Promise<Order> {
    const order = await this.findOne(id, user);

    const allowed = ALLOWED_TRANSITIONS[order.status];
    if (!allowed.includes(dto.status)) {
      throw new UnprocessableEntityException(
        `Cannot transition order from ${order.status} to ${dto.status}`,
      );
    }

    order.status = dto.status;
    return this.ordersRepository.save(order);
  }
}
