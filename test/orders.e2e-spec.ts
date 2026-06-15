import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let userToken: string;
  let otherUserToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const server = app.getHttpServer();

    await request(server).post('/auth/register').send({
      email: 'buyer@example.com',
      password: 'Password123',
      name: 'Buyer',
    });
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'buyer@example.com', password: 'Password123' });
    userToken = loginRes.body.access_token;

    await request(server).post('/auth/register').send({
      email: 'other@example.com',
      password: 'Password123',
      name: 'Other',
    });
    const otherLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'other@example.com', password: 'Password123' });
    otherUserToken = otherLoginRes.body.access_token;

    const adminLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin@12345' });
    adminToken = adminLoginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/orders', () => {
    it('rejects requests without a JWT', async () => {
      await request(app.getHttpServer())
        .post('/api/orders')
        .send({ productId: 1, quantity: 1 })
        .expect(401);
    });

    it('rejects an invalid quantity', async () => {
      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: 1, quantity: 0 })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: 1, quantity: 11 })
        .expect(400);
    });

    it('returns 404 for a non-existent product', async () => {
      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: 9999, quantity: 1 })
        .expect(404);
    });

    it('creates an order and computes the total from the product price', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: 1, quantity: 2 })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          productId: 1,
          quantity: 2,
          total: 50,
          status: 'PENDING',
        }),
      );
    });

    it('returns 400 when the requested quantity exceeds remaining stock', async () => {
      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: 3, quantity: 10 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: 3, quantity: 9999 })
        .expect(400);
    });
  });

  describe('GET /api/orders/:id', () => {
    let orderId: number;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: 2, quantity: 1 });
      orderId = response.body.id;
    });

    it('allows the owner to view their order', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(orderId);
    });

    it('forbids a different user from viewing the order', async () => {
      await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });

    it('allows an admin to view any order', async () => {
      await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('returns 404 for an unknown order id', async () => {
      await request(app.getHttpServer())
        .get('/api/orders/999999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/orders/:id/status', () => {
    let orderId: number;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: 2, quantity: 1 });
      orderId = response.body.id;
    });

    it('allows a valid transition from PENDING to CONFIRMED', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      expect(response.body.status).toBe('CONFIRMED');
    });

    it('rejects an invalid transition with 422', async () => {
      await request(app.getHttpServer())
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'DELIVERED' })
        .expect(422);
    });

    it('rejects an unrecognized status value with 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'NOT_A_STATUS' })
        .expect(400);
    });
  });
});
