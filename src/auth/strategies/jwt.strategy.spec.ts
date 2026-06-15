import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UserRole } from '../../users/entities/user.entity';

describe('JwtStrategy', () => {
  it('maps the JWT payload to an authenticated user', () => {
    const configService = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(configService);

    const result = strategy.validate({
      sub: 1,
      email: 'a@example.com',
      role: UserRole.ADMIN,
    });

    expect(result).toEqual({
      userId: 1,
      email: 'a@example.com',
      role: UserRole.ADMIN,
    });
  });
});
