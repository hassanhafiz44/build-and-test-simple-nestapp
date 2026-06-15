import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../utils/test-app';

/**
 * Pins down the global ValidationPipe's `whitelist` option: extra fields sent
 * by a client must be stripped before reaching the service layer, so a
 * caller cannot self-assign privileges or attribute data to another user.
 */
describe('Mass-assignment protection (regression)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('ignores an attacker-supplied "role" field on registration', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/auth/register')
      .send({
        email: 'hacker@example.com',
        password: 'Password123',
        name: 'Hacker',
        role: 'admin',
      })
      .expect(201);

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'hacker@example.com', password: 'Password123' })
      .expect(200);

    await request(server)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${loginRes.body.access_token}`)
      .expect(403);
  });

  it('ignores an attacker-supplied "userId" field when creating an order', async () => {
    const server = app.getHttpServer();

    await request(server).post('/auth/register').send({
      email: 'attacker@example.com',
      password: 'Password123',
      name: 'Attacker',
    });
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'attacker@example.com', password: 'Password123' });

    const createRes = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${loginRes.body.access_token}`)
      .send({ productId: 1, quantity: 1, userId: 999999 })
      .expect(201);

    expect(createRes.body.userId).not.toBe(999999);

    // the order is owned by the attacker (not user 999999), so they can read it back
    await request(server)
      .get(`/api/orders/${createRes.body.id}`)
      .set('Authorization', `Bearer ${loginRes.body.access_token}`)
      .expect(200);
  });
});
