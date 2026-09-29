import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { JwtPayload } from '@cullinos/auth';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CurrentUser, OrgId, RequireModule } from '../../common/decorators';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { HospitalityService } from './hospitality.service';

class CreateGuestDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;
}

class UpdateGuestDto {
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
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;
}

class CreateRoomDto {
  @IsString()
  outletId!: string;

  @IsString()
  roomTypeId!: string;

  @IsString()
  number!: string;

  @IsOptional()
  @IsInt()
  floor?: number;
}

class UpdateRoomDto {
  @IsOptional()
  @IsInt()
  floor?: number;

  @IsOptional()
  @IsIn(['available', 'occupied', 'maintenance', 'blocked'])
  status?: string;
}

class RoomPostingDto {
  @IsString()
  roomId!: string;

  @IsString()
  guestId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsDateString()
  checkIn?: string;
}

class CreateBanquetEventDto {
  @IsString()
  banquetId!: string;

  @IsString()
  guestId!: string;

  @IsDateString()
  eventDate!: string;

  @IsInt()
  @Min(1)
  guestCount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total?: number;
}

class UpdateBanquetStatusDto {
  @IsIn(['inquiry', 'confirmed', 'in_progress', 'completed', 'cancelled'])
  status!: string;
}

@ApiTags('hospitality')
@ApiBearerAuth()
@RequireModule('hotel')
@RequirePermissions('order:update')
@Controller('hospitality')
export class HospitalityController {
  constructor(private readonly hospitalityService: HospitalityService) {}

  @Get('guests')
  @RequirePermissions('order:read', 'customer:read')
  findAllGuests(@OrgId() organizationId: string) {
    return this.hospitalityService.findAllGuests(organizationId);
  }

  @Get('guests/:id')
  @RequirePermissions('order:read', 'customer:read')
  findGuest(
    @Param('id') id: string,
    @OrgId() organizationId: string,
  ) {
    return this.hospitalityService.findGuest(id, organizationId);
  }

  @Post('guests')
  createGuest(
    @OrgId() organizationId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateGuestDto,
  ) {
    return this.hospitalityService.createGuest(organizationId, user.sub, dto);
  }

  @Patch('guests/:id')
  updateGuest(
    @Param('id') id: string,
    @OrgId() organizationId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateGuestDto,
  ) {
    return this.hospitalityService.updateGuest(id, organizationId, user.sub, dto);
  }

  @Post('guests/:id/checkout')
  checkOutGuest(
    @Param('id') id: string,
    @OrgId() organizationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.hospitalityService.checkOutGuest(id, organizationId, user.sub);
  }

  @Get('rooms')
  @RequirePermissions('order:read', 'outlet:read')
  findAllRooms(
    @OrgId() organizationId: string,
    @Query('outletId') outletId?: string,
  ) {
    return this.hospitalityService.findAllRooms(outletId ?? '', organizationId);
  }

  @Post('rooms')
  @RequirePermissions('outlet:update')
  createRoom(
    @OrgId() organizationId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRoomDto,
  ) {
    return this.hospitalityService.createRoom(organizationId, user.sub, dto);
  }

  @Patch('rooms/:id')
  @RequirePermissions('outlet:update')
  updateRoom(
    @Param('id') id: string,
    @OrgId() organizationId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.hospitalityService.updateRoom(id, organizationId, user.sub, dto);
  }

  @Post('room-postings')
  postToRoom(
    @OrgId() organizationId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RoomPostingDto,
  ) {
    return this.hospitalityService.postToRoom(organizationId, user.sub, {
      ...dto,
      checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
    });
  }

  @Post('room-postings/:id/settle')
  @RequirePermissions('pos:access')
  settleRoomPosting(
    @Param('id') id: string,
    @OrgId() organizationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.hospitalityService.settleRoomPosting(id, organizationId, user.sub);
  }

  @Get('banquet-events')
  @RequirePermissions('order:read')
  findBanquetEvents(
    @OrgId() organizationId: string,
    @Query('banquetId') banquetId?: string,
  ) {
    return this.hospitalityService.findBanquetEvents(organizationId, banquetId);
  }

  @Post('banquet-events')
  @RequirePermissions('order:create')
  createBanquetEvent(
    @OrgId() organizationId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBanquetEventDto,
  ) {
    return this.hospitalityService.createBanquetEvent(organizationId, user.sub, {
      ...dto,
      eventDate: new Date(dto.eventDate),
    });
  }

  @Patch('banquet-events/:id/status')
  updateBanquetStatus(
    @Param('id') id: string,
    @OrgId() organizationId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateBanquetStatusDto,
  ) {
    return this.hospitalityService.updateBanquetEventStatus(
      id,
      organizationId,
      user.sub,
      dto.status,
    );
  }
}
