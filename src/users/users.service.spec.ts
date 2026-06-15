import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('onModuleInit', () => {
    it('seeds a default admin user when none exists', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockImplementation((data) => data);
      repo.save.mockImplementation(async (data) => ({ id: 1, ...data }));

      await service.onModuleInit();

      expect(repo.create).toHaveBeenCalledTimes(1);
      const created = repo.create.mock.calls[0][0];
      expect(created.email).toBe('admin@example.com');
      expect(created.role).toBe(UserRole.ADMIN);
      expect(await bcrypt.compare('Admin@12345', created.password)).toBe(true);
      expect(repo.save).toHaveBeenCalled();
    });

    it('does nothing when the admin user already exists', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      });

      await service.onModuleInit();

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('looks up a user by email', async () => {
      repo.findOne.mockResolvedValue({ id: 1, email: 'a@example.com' });

      const result = await service.findByEmail('a@example.com');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { email: 'a@example.com' },
      });
      expect(result).toEqual({ id: 1, email: 'a@example.com' });
    });
  });

  describe('findById', () => {
    it('looks up a user by id', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });

      const result = await service.findById(1);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('create', () => {
    it('creates a user with the USER role', async () => {
      repo.create.mockImplementation((data) => data);
      repo.save.mockImplementation(async (data) => ({ id: 2, ...data }));

      const result = await service.create({
        email: 'b@example.com',
        password: 'hashed',
        name: 'B',
      });

      expect(repo.create).toHaveBeenCalledWith({
        email: 'b@example.com',
        password: 'hashed',
        name: 'B',
        role: UserRole.USER,
      });
      expect(result).toEqual({
        id: 2,
        email: 'b@example.com',
        password: 'hashed',
        name: 'B',
        role: UserRole.USER,
      });
    });
  });

  describe('findAll', () => {
    it('returns all users', async () => {
      repo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const result = await service.findAll();

      expect(repo.find).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });
});
