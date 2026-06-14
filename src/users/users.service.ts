import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    const adminEmail = 'admin@example.com';
    const existing = await this.findByEmail(adminEmail);
    if (!existing) {
      const password = await bcrypt.hash('Admin@12345', 10);
      await this.usersRepository.save(
        this.usersRepository.create({
          email: adminEmail,
          password,
          name: 'Admin',
          role: UserRole.ADMIN,
        }),
      );
      this.logger.log(`Seeded admin user: ${adminEmail} / Admin@12345`);
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(data: { email: string; password: string; name: string }): Promise<User> {
    const user = this.usersRepository.create({
      ...data,
      role: UserRole.USER,
    });
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }
}
