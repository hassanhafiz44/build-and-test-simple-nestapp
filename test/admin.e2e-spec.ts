import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

describe('Admin (e2e)', () => {
  let app: INestApplication;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const server = app.getHttpServer();

    await request(server).post('/auth/register').send({
      email: 'regular@example.com',
      password: 'Password123',
      name: 'Regular',
    });
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'regular@example.com', password: 'Password123' });
    userToken = loginRes.body.access_token;

    const adminLoginRes = await request(server)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin@12345' });
    adminToken = adminLoginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests without a JWT', async () => {
    await request(app.getHttpServer()).get('/api/admin/users').expect(401);
  });

  it('rejects regular users with 403', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('returns the user list for admins without exposing passwords', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(
      response.body.some(
        (user: { email: string }) => user.email === 'regular@example.com',
      ),
    ).toBe(true);
    for (const user of response.body) {
      expect(user.password).toBeUndefined();
    }
  });
});
