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
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FranchiseService } from './franchise.service';

class CreateFranchiseeDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}

class UpdateFranchiseeDto extends CreateFranchiseeDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class CreateAgreementDto {
  @IsString()
  franchiseeId!: string;

  @IsOptional()
  @IsString()
  outletId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  royaltyPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  franchiseFee?: number;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

class UpdateAgreementDto {
  @IsOptional()
  @IsString()
  outletId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  royaltyPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  franchiseFee?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

@ApiTags('franchise')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('franchise')
export class FranchiseController {
  constructor(private readonly franchiseService: FranchiseService) {}

  @Get('franchisees')
  findAllFranchisees(@CurrentUser('organizationId') organizationId: string) {
    return this.franchiseService.findAllFranchisees(organizationId);
  }

  @Get('franchisees/:id')
  findFranchisee(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.franchiseService.findFranchisee(id, organizationId);
  }

  @Post('franchisees')
  createFranchisee(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateFranchiseeDto,
  ) {
    return this.franchiseService.createFranchisee(user.organizationId, user.id, dto);
  }

  @Patch('franchisees/:id')
  updateFranchisee(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateFranchiseeDto,
  ) {
    return this.franchiseService.updateFranchisee(id, user.organizationId, user.id, dto);
  }

  @Delete('franchisees/:id')
  deleteFranchisee(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.franchiseService.deleteFranchisee(id, user.organizationId, user.id);
  }

  @Get('franchisees/:id/agreements')
  findAgreements(
    @Param('id') franchiseeId: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.franchiseService.findAgreements(franchiseeId, organizationId);
  }

  @Post('agreements')
  createAgreement(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateAgreementDto,
  ) {
    return this.franchiseService.createAgreement(user.organizationId, user.id, {
      ...dto,
      startsAt: new Date(dto.startsAt),
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
    });
  }

  @Patch('agreements/:id')
  updateAgreement(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateAgreementDto,
  ) {
    return this.franchiseService.updateAgreement(id, user.organizationId, user.id, {
      ...dto,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
    });
  }

  @Post('agreements/:id/terminate')
  terminateAgreement(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.franchiseService.terminateAgreement(id, user.organizationId, user.id);
  }
}
