import {
  Body,
  Controller,
  Delete,
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
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InventoryService } from './inventory.service';

class CreateInventoryItemDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  costPerUnit?: number;
}

class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  costPerUnit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class StockAdjustmentDto {
  @IsString()
  outletId!: string;

  @IsString()
  inventoryItemId!: string;

  @IsNumber()
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

class StockTransferDto {
  @IsString()
  inventoryItemId!: string;

  @IsString()
  fromOutletId!: string;

  @IsString()
  toOutletId!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('items')
  findAllItems(@CurrentUser('organizationId') organizationId: string) {
    return this.inventoryService.findAllItems(organizationId);
  }

  @Get('items/:id')
  findItem(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.inventoryService.findItem(id, organizationId);
  }

  @Post('items')
  createItem(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.inventoryService.createItem(user.organizationId, user.id, dto);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateItem(id, user.organizationId, user.id, dto);
  }

  @Delete('items/:id')
  deleteItem(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.inventoryService.deleteItem(id, user.organizationId, user.id);
  }

  @Get('stock')
  getStockLevels(
    @Query('outletId') outletId: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.inventoryService.getStockLevels(outletId, organizationId);
  }

  @Get('movements')
  getStockMovements(
    @Query('outletId') outletId: string,
    @Query('inventoryItemId') inventoryItemId?: string,
  ) {
    return this.inventoryService.getStockMovements(outletId, inventoryItemId);
  }

  @Post('adjustments')
  adjustStock(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: StockAdjustmentDto,
  ) {
    return this.inventoryService.adjustStock(user.organizationId, user.id, dto);
  }

  @Post('transfers')
  transferStock(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: StockTransferDto,
  ) {
    return this.inventoryService.transferStock(user.organizationId, user.id, dto);
  }
}
