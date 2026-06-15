import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService implements OnModuleInit {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async onModuleInit() {
    const count = await this.productsRepository.count();
    if (count === 0) {
      await this.productsRepository.save([
        this.productsRepository.create({
          name: 'Wireless Mouse',
          price: 25,
          stock: 100,
        }),
        this.productsRepository.create({
          name: 'Mechanical Keyboard',
          price: 75,
          stock: 50,
        }),
        this.productsRepository.create({
          name: 'USB-C Hub',
          price: 40,
          stock: 30,
        }),
      ]);
      this.logger.log('Seeded product catalog');
    }
  }

  findById(id: number): Promise<Product | null> {
    return this.productsRepository.findOne({ where: { id } });
  }

  async save(product: Product): Promise<Product> {
    return this.productsRepository.save(product);
  }
}
