import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../utils/test-app';
import { OrderStatus } from '../../src/orders/entities/order.entity';

const ALL_STATUSES = Object.values(OrderStatus);

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

/**
 * Pins down the full order status state machine via the API so that any
 * future change to ALLOWED_TRANSITIONS in orders.service.ts is caught here.
 */
describe('Order status transition matrix (regression)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    const server = app.getHttpServer();

    await request(server).post('/auth/register').send({
      email: 'matrix@example.com',
      password: 'Password123',
      name: 'Matrix',
    });
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'matrix@example.com', password: 'Password123' });
    token = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  const driveToStatus = async (target: OrderStatus): Promise<number> => {
    const createRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 1, quantity: 1 });
    const orderId: number = createRes.body.id;

    const pathToTarget: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [],
      [OrderStatus.CONFIRMED]: [OrderStatus.CONFIRMED],
      [OrderStatus.DELIVERED]: [OrderStatus.CONFIRMED, OrderStatus.DELIVERED],
      [OrderStatus.CANCELLED]: [OrderStatus.CANCELLED],
    };

    for (const status of pathToTarget[target]) {
      await request(app.getHttpServer())
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status })
        .expect(200);
    }

    return orderId;
  };

  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      if (from === to) continue;
      const isAllowed = ALLOWED_TRANSITIONS[from].includes(to);

      it(`${isAllowed ? 'allows' : 'rejects'} ${from} -> ${to}`, async () => {
        const orderId = await driveToStatus(from);

        await request(app.getHttpServer())
          .patch(`/api/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: to })
          .expect(isAllowed ? 200 : 422);
      });
    }
  }
});
