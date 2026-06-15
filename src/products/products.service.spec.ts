import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

describe('ProductsService', () => {
  let service: ProductsService;
  let repo: {
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: repo },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  describe('onModuleInit', () => {
    it('seeds the product catalog when empty', async () => {
      repo.count.mockResolvedValue(0);
      repo.create.mockImplementation((data) => data);
      repo.save.mockResolvedValue([]);

      await service.onModuleInit();

      expect(repo.create).toHaveBeenCalledTimes(3);
      expect(repo.save).toHaveBeenCalledWith([
        { name: 'Wireless Mouse', price: 25, stock: 100 },
        { name: 'Mechanical Keyboard', price: 75, stock: 50 },
        { name: 'USB-C Hub', price: 40, stock: 30 },
      ]);
    });

    it('does not reseed when products already exist', async () => {
      repo.count.mockResolvedValue(3);

      await service.onModuleInit();

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('delegates to the repository', async () => {
      repo.findOne.mockResolvedValue({ id: 1, name: 'Wireless Mouse' });

      const result = await service.findById(1);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ id: 1, name: 'Wireless Mouse' });
    });
  });

  describe('save', () => {
    it('persists the product', async () => {
      const product = {
        id: 1,
        name: 'Wireless Mouse',
        price: 25,
        stock: 99,
      };
      repo.save.mockResolvedValue(product);

      const result = await service.save(product);

      expect(repo.save).toHaveBeenCalledWith(product);
      expect(result).toBe(product);
    });
  });
});
