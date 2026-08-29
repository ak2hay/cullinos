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
import { TaxService } from './tax.service';

class CreateTaxGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isInclusive?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateTaxGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isInclusive?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class CreateTaxRateDto {
  @IsString()
  taxGroupId!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  rate!: number;

  @IsOptional()
  @IsString()
  type?: string;
}

class UpdateTaxRateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @IsOptional()
  @IsString()
  type?: string;
}

class CalculateTaxDto {
  @IsInt()
  @Min(0)
  amount!: number;

  @IsString()
  taxGroupId!: string;

  @IsOptional()
  @IsBoolean()
  isInterState?: boolean;
}

@ApiTags('tax')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tax')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get('groups')
  findAllGroups(@CurrentUser('organizationId') organizationId: string) {
    return this.taxService.findAllGroups(organizationId);
  }

  @Get('groups/:id')
  findGroup(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.taxService.findGroup(id, organizationId);
  }

  @Post('groups')
  createGroup(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateTaxGroupDto,
  ) {
    return this.taxService.createGroup(user.organizationId, user.id, dto);
  }

  @Patch('groups/:id')
  updateGroup(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateTaxGroupDto,
  ) {
    return this.taxService.updateGroup(id, user.organizationId, user.id, dto);
  }

  @Delete('groups/:id')
  deleteGroup(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.taxService.deleteGroup(id, user.organizationId, user.id);
  }

  @Post('rates')
  createRate(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateTaxRateDto,
  ) {
    return this.taxService.createRate(user.organizationId, user.id, dto);
  }

  @Patch('rates/:id')
  updateRate(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateTaxRateDto,
  ) {
    return this.taxService.updateRate(id, user.organizationId, user.id, dto);
  }

  @Delete('rates/:id')
  deleteRate(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.taxService.deleteRate(id, user.organizationId, user.id);
  }

  @Post('calculate')
  calculateTax(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CalculateTaxDto,
  ) {
    return this.taxService.calculateTaxForAmount(organizationId, dto);
  }
}
