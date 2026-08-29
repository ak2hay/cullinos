import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeliveryService } from './delivery.service';

class CreateDeliveryZoneDto {
  @IsString()
  outletId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minCharge?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  charge?: number;

  @IsOptional()
  @IsNumber()
  radius?: number;
}

class UpdateDeliveryZoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minCharge?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  charge?: number;

  @IsOptional()
  @IsNumber()
  radius?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class CreateDeliveryOrderDto {
  @IsString()
  orderId!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  deliveryCharge?: number;

  @IsOptional()
  @IsDateString()
  estimatedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateDeliveryStatusDto {
  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class AssignDeliveryDto {
  @IsString()
  deliveryPersonId!: string;
}

@ApiTags('delivery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('zones')
  findAllZones(@Query('outletId') outletId: string) {
    return this.deliveryService.findAllZones(outletId);
  }

  @Post('zones')
  createZone(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateDeliveryZoneDto,
  ) {
    return this.deliveryService.createZone(user.organizationId, user.id, dto);
  }

  @Patch('zones/:id')
  updateZone(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateDeliveryZoneDto,
  ) {
    return this.deliveryService.updateZone(id, user.organizationId, user.id, dto);
  }

  @Get('orders')
  findDeliveryOrders(
    @Query('outletId') outletId?: string,
    @Query('status') status?: string,
  ) {
    return this.deliveryService.findDeliveryOrders(outletId, status);
  }

  @Get('orders/:id')
  findDeliveryOrder(@Param('id') id: string) {
    return this.deliveryService.findDeliveryOrder(id);
  }

  @Post('orders')
  createDeliveryOrder(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateDeliveryOrderDto,
  ) {
    return this.deliveryService.createDeliveryOrder(user.organizationId, user.id, {
      ...dto,
      estimatedAt: dto.estimatedAt ? new Date(dto.estimatedAt) : undefined,
    });
  }

  @Patch('orders/:id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.deliveryService.updateStatus(id, user.organizationId, user.id, dto);
  }

  @Post('orders/:id/assign')
  assignDeliveryPerson(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: AssignDeliveryDto,
  ) {
    return this.deliveryService.assignDeliveryPerson(
      id,
      user.organizationId,
      user.id,
      dto,
    );
  }
}
