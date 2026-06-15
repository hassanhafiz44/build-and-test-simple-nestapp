import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../utils/test-app';

/**
 * Pins down stock depletion behaviour: each order must decrement the
 * product's stock by exactly the ordered quantity, and an order that would
 * push stock below zero must be rejected rather than allowed to go negative.
 */
describe('Stock management (regression)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    const server = app.getHttpServer();

    await request(server).post('/auth/register').send({
      email: 'stock@example.com',
      password: 'Password123',
      name: 'Stock',
    });
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'stock@example.com', password: 'Password123' });
    token = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('decrements stock on each order and rejects orders once stock is exhausted', async () => {
    const server = app.getHttpServer();

    // USB-C Hub (product id 3) is seeded with 30 units in stock at $40 each.
    for (let i = 0; i < 3; i++) {
      const response = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: 3, quantity: 10 })
        .expect(201);

      expect(response.body.total).toBe(400);
    }

    // stock is now exactly 0 — even a 1-unit order must be rejected
    await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 3, quantity: 1 })
      .expect(400);
  });
});
