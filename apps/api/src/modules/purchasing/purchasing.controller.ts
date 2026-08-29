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
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PurchasingService } from './purchasing.service';

class CreateSupplierDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class CreatePurchaseOrderDto {
  @IsString()
  supplierId!: string;

  @IsString()
  outletId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

class ReceivedItemDto {
  @IsString()
  inventoryItemId!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;
}

class CreateGRNDto {
  @IsString()
  purchaseOrderId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivedItemDto)
  receivedItems?: ReceivedItemDto[];
}

class CreatePurchaseInvoiceDto {
  @IsString()
  supplierId!: string;

  @IsString()
  invoiceNumber!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

@ApiTags('purchasing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchasing')
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  @Get('suppliers')
  findAllSuppliers(@CurrentUser('organizationId') organizationId: string) {
    return this.purchasingService.findAllSuppliers(organizationId);
  }

  @Get('suppliers/:id')
  findSupplier(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.purchasingService.findSupplier(id, organizationId);
  }

  @Post('suppliers')
  createSupplier(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateSupplierDto,
  ) {
    return this.purchasingService.createSupplier(user.organizationId, user.id, dto);
  }

  @Patch('suppliers/:id')
  updateSupplier(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.purchasingService.updateSupplier(id, user.organizationId, user.id, dto);
  }

  @Delete('suppliers/:id')
  deleteSupplier(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.purchasingService.deleteSupplier(id, user.organizationId, user.id);
  }

  @Get('purchase-orders')
  findPurchaseOrders(
    @Query('outletId') outletId?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.purchasingService.findPurchaseOrders(outletId, supplierId);
  }

  @Post('purchase-orders')
  createPurchaseOrder(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.purchasingService.createPurchaseOrder(user.organizationId, user.id, dto);
  }

  @Post('purchase-orders/:id/approve')
  approvePurchaseOrder(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.purchasingService.approvePurchaseOrder(id, user.organizationId, user.id);
  }

  @Post('grn')
  createGRN(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateGRNDto,
  ) {
    return this.purchasingService.createGRN(user.organizationId, user.id, dto);
  }

  @Get('invoices')
  findPurchaseInvoices(@Query('supplierId') supplierId?: string) {
    return this.purchasingService.findPurchaseInvoices(supplierId);
  }

  @Post('invoices')
  createPurchaseInvoice(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreatePurchaseInvoiceDto,
  ) {
    return this.purchasingService.createPurchaseInvoice(user.organizationId, user.id, {
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });
  }

  @Post('invoices/:id/pay')
  markInvoicePaid(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.purchasingService.markPurchaseInvoicePaid(id, user.organizationId, user.id);
  }
}
