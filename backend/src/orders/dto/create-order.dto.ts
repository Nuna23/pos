import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class PushSubscriptionDto {
  @IsString()
  endpoint: string;

  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}

class CreateOrderItemDto {
  @IsInt()
  baseDoughId: number;

  @IsArray()
  @IsInt({ each: true })
  toppingIds: number[];
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PushSubscriptionDto)
  pushSubscription?: PushSubscriptionDto;
}
