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
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CustomersService } from './customers.service';

class CreateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsDateString()
  birthday?: string;

  @IsOptional()
  @IsDateString()
  anniversary?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateCustomerDto extends CreateCustomerDto {
  @IsOptional()
  @IsString()
  segment?: string;
}

class UpdateSegmentDto {
  @IsString()
  segment!: string;
}

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query('segment') segment?: string,
  ) {
    return this.customersService.findAll(organizationId, segment);
  }

  @Get('segmentation')
  getSegmentation(@CurrentUser('organizationId') organizationId: string) {
    return this.customersService.getSegmentationSummary(organizationId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.customersService.findOne(id, organizationId);
  }

  @Get(':id/orders')
  getOrderHistory(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.customersService.getOrderHistory(id, organizationId);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(user.organizationId, user.id, {
      ...dto,
      birthday: dto.birthday ? new Date(dto.birthday) : undefined,
      anniversary: dto.anniversary ? new Date(dto.anniversary) : undefined,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, user.organizationId, user.id, {
      ...dto,
      birthday: dto.birthday ? new Date(dto.birthday) : undefined,
      anniversary: dto.anniversary ? new Date(dto.anniversary) : undefined,
    });
  }

  @Patch(':id/segment')
  updateSegment(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateSegmentDto,
  ) {
    return this.customersService.updateSegment(
      id,
      user.organizationId,
      user.id,
      dto.segment,
    );
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.customersService.delete(id, user.organizationId, user.id);
  }
}
