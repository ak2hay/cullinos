import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WastageService } from './wastage.service';

class RecordWastageDto {
  @IsString()
  inventoryItemId!: string;

  @IsString()
  outletId!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('wastage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wastage')
export class WastageController {
  constructor(private readonly wastageService: WastageService) {}

  @Post()
  recordWastage(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: RecordWastageDto,
  ) {
    return this.wastageService.recordWastage(user.organizationId, user.id, dto);
  }

  @Get('reports')
  getReports(
    @CurrentUser('organizationId') organizationId: string,
    @Query('outletId') outletId?: string,
    @Query('inventoryItemId') inventoryItemId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.wastageService.getReports(organizationId, {
      outletId,
      inventoryItemId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }
}
