import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../src/auth/auth.module';
import { Order } from '../../src/orders/entities/order.entity';
import { OrdersModule } from '../../src/orders/orders.module';
import { Product } from '../../src/products/entities/product.entity';
import { ProductsModule } from '../../src/products/products.module';
import { User } from '../../src/users/entities/user.entity';
import { UsersModule } from '../../src/users/users.module';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: [User, Product, Order],
        synchronize: true,
        dropSchema: true,
      }),
      AuthModule,
      UsersModule,
      ProductsModule,
      OrdersModule,
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}
