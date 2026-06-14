import { IsInt, Max, Min } from 'class-validator';

export class CreateOrderDto {
  @IsInt()
  @Min(1)
  productId: number;

  @IsInt()
  @Min(1)
  @Max(10)
  quantity: number;
}
