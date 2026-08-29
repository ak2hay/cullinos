import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoyaltyService } from './loyalty.service';

class CreateTierDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minPoints?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPct?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

class UpdateTierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minPoints?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPct?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

class PointsTransactionDto {
  @IsString()
  accountId!: string;

  @IsInt()
  @Min(1)
  points!: number;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('loyalty')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('tiers')
  findAllTiers(@CurrentUser('organizationId') organizationId: string) {
    return this.loyaltyService.findAllTiers(organizationId);
  }

  @Post('tiers')
  createTier(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateTierDto,
  ) {
    return this.loyaltyService.createTier(user.organizationId, user.id, dto);
  }

  @Patch('tiers/:id')
  updateTier(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateTierDto,
  ) {
    return this.loyaltyService.updateTier(id, user.organizationId, user.id, dto);
  }

  @Delete('tiers/:id')
  deleteTier(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.loyaltyService.deleteTier(id, user.organizationId, user.id);
  }

  @Get('accounts/customer/:customerId')
  getOrCreateAccount(
    @Param('customerId') customerId: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.loyaltyService.getOrCreateAccount(customerId, organizationId);
  }

  @Get('accounts/:id')
  findAccount(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.loyaltyService.findAccount(id, organizationId);
  }

  @Post('points/add')
  addPoints(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: PointsTransactionDto,
  ) {
    return this.loyaltyService.addPoints(user.organizationId, user.id, dto);
  }

  @Post('points/deduct')
  deductPoints(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: PointsTransactionDto,
  ) {
    return this.loyaltyService.deductPoints(user.organizationId, user.id, dto);
  }
}
