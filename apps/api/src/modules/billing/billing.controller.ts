import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService } from './billing.service';

class CreditNoteDto {
  @IsString()
  orderId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices/order/:orderId')
  findInvoices(@Param('orderId') orderId: string) {
    return this.billingService.findInvoicesByOrder(orderId);
  }

  @Get('credit-notes/order/:orderId')
  findCreditNotes(@Param('orderId') orderId: string) {
    return this.billingService.findCreditNotesByOrder(orderId);
  }

  @Post('invoices')
  generateInvoice(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body('orderId') orderId: string,
  ) {
    return this.billingService.generateInvoice(user.organizationId, user.id, orderId);
  }

  @Post('tax-invoices')
  generateTaxInvoice(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body('orderId') orderId: string,
  ) {
    return this.billingService.generateTaxInvoice(user.organizationId, user.id, orderId);
  }

  @Post('credit-notes')
  generateCreditNote(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreditNoteDto,
  ) {
    return this.billingService.generateCreditNote(
      user.organizationId,
      user.id,
      dto.orderId,
      dto.amount,
      dto.reason,
    );
  }
}
