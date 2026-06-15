import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByEmail: jest.Mock; create: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    usersService = { findByEmail: jest.fn(), create: jest.fn() };
    jwtService = { signAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('hashes the password, creates the user, and never returns the password', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation(async (data) => ({
        id: 1,
        ...data,
        role: UserRole.USER,
      }));

      const result = await service.register({
        email: 'new@example.com',
        password: 'plainPassword1',
        name: 'New User',
      });

      const createArgs = usersService.create.mock.calls[0][0];
      expect(createArgs.password).not.toBe('plainPassword1');
      expect(await bcrypt.compare('plainPassword1', createArgs.password)).toBe(
        true,
      );
      expect(result).toEqual({
        id: 1,
        email: 'new@example.com',
        name: 'New User',
      });
    });

    it('throws ConflictException when the email is already registered', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'existing@example.com',
      });

      await expect(
        service.register({
          email: 'existing@example.com',
          password: 'plainPassword1',
          name: 'X',
        }),
      ).rejects.toThrow(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when the user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'missing@example.com', password: 'whatever' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password is incorrect', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        password: await bcrypt.hash('correctPassword', 10),
        role: UserRole.USER,
      });

      await expect(
        service.login({ email: 'user@example.com', password: 'wrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns an access token when credentials are valid', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        password: await bcrypt.hash('correctPassword', 10),
        role: UserRole.USER,
      });
      jwtService.signAsync.mockResolvedValue('signed-jwt');

      const result = await service.login({
        email: 'user@example.com',
        password: 'correctPassword',
      });

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 1,
        email: 'user@example.com',
        role: UserRole.USER,
      });
      expect(result).toEqual({ access_token: 'signed-jwt' });
    });
  });
});
