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
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffService } from './staff.service';

class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  outletId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  employeeCode?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;
}

class UpdateEmployeeDto extends CreateEmployeeDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class OpenShiftDto {
  @IsString()
  outletId!: string;

  @IsString()
  employeeId!: string;

  @IsInt()
  @Min(0)
  openingCash!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

class CloseShiftDto {
  @IsInt()
  @Min(0)
  closingCash!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

class CashMovementDto {
  @IsString()
  shiftId!: string;

  @IsString()
  type!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('employees')
  findAllEmployees(
    @CurrentUser('organizationId') organizationId: string,
    @Query('outletId') outletId?: string,
  ) {
    return this.staffService.findAllEmployees(organizationId, outletId);
  }

  @Get('employees/:id')
  findEmployee(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.staffService.findEmployee(id, organizationId);
  }

  @Post('employees')
  createEmployee(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.staffService.createEmployee(user.organizationId, user.id, {
      ...dto,
      hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
    });
  }

  @Patch('employees/:id')
  updateEmployee(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.staffService.updateEmployee(id, user.organizationId, user.id, {
      ...dto,
      hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
    });
  }

  @Delete('employees/:id')
  deleteEmployee(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.staffService.deleteEmployee(id, user.organizationId, user.id);
  }

  @Post('employees/:id/check-in')
  checkIn(
    @Param('id') employeeId: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.staffService.checkIn(employeeId, user.organizationId, user.id);
  }

  @Post('employees/:id/check-out')
  checkOut(
    @Param('id') employeeId: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.staffService.checkOut(employeeId, user.organizationId, user.id);
  }

  @Get('employees/:id/attendance')
  getAttendance(
    @Param('id') employeeId: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.staffService.getAttendance(employeeId, organizationId);
  }

  @Get('shifts')
  findShifts(
    @Query('outletId') outletId: string,
    @Query('status') status?: string,
  ) {
    return this.staffService.findShifts(outletId, status);
  }

  @Post('shifts/open')
  openShift(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: OpenShiftDto,
  ) {
    return this.staffService.openShift(user.organizationId, user.id, dto);
  }

  @Post('shifts/:id/close')
  closeShift(
    @Param('id') shiftId: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CloseShiftDto,
  ) {
    return this.staffService.closeShift(shiftId, user.organizationId, user.id, dto);
  }

  @Post('cash-movements')
  recordCashMovement(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CashMovementDto,
  ) {
    return this.staffService.recordCashMovement(user.organizationId, user.id, dto);
  }
}
