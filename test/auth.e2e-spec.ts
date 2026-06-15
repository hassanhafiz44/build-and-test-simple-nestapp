import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('creates a new user and never returns the password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'alice@example.com',
          password: 'Password123',
          name: 'Alice',
        })
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(Number),
        email: 'alice@example.com',
        name: 'Alice',
      });
      expect(response.body.password).toBeUndefined();
    });

    it('rejects a duplicate email with 409', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'alice@example.com',
          password: 'AnotherPassword1',
          name: 'Alice 2',
        })
        .expect(409);
    });

    it('rejects a password shorter than 8 characters', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'short@example.com', password: 'short', name: 'Short' })
        .expect(400);
    });

    it('rejects an invalid email address', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'Password123',
          name: 'Bad Email',
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('returns a JWT for valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'alice@example.com', password: 'Password123' })
        .expect(200);

      expect(typeof response.body.access_token).toBe('string');
    });

    it('rejects an incorrect password with 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'alice@example.com', password: 'WrongPassword' })
        .expect(401);
    });

    it('rejects an unknown email with 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'Password123' })
        .expect(401);
    });
  });
});
