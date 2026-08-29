import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';

class PaymentTenderDto {
  @IsString()
  method!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

class ProcessPaymentDto {
  @IsString()
  orderId!: string;

  @IsString()
  method!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  gatewayRef?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  tipAmount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentTenderDto)
  tenders?: PaymentTenderDto[];
}

class PartialPaymentDto {
  @IsString()
  orderId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  method!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  tipAmount?: number;
}

class RefundPaymentDto {
  @IsString()
  paymentId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('order/:orderId')
  findByOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.findByOrder(orderId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post('process')
  processPayment(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: ProcessPaymentDto,
  ) {
    return this.paymentsService.processPayment(user.organizationId, user.id, dto);
  }

  @Post('partial')
  partialPayment(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: PartialPaymentDto,
  ) {
    return this.paymentsService.processPartialPayment(
      user.organizationId,
      user.id,
      dto,
    );
  }

  @Post('refund')
  refund(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: RefundPaymentDto,
  ) {
    return this.paymentsService.refund(user.organizationId, user.id, dto);
  }
}
