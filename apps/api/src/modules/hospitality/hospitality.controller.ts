import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireModule } from '../../common/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
@UseGuards(JwtAuthGuard)
@RequireModule('hotel')
@Controller('hospitality')
export class HospitalityController {
  constructor(private readonly hospitalityService: HospitalityService) {}

  @Get('guests')
  findAllGuests(@CurrentUser('organizationId') organizationId: string) {
    return this.hospitalityService.findAllGuests(organizationId);
  }

  @Get('guests/:id')
  findGuest(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.hospitalityService.findGuest(id, organizationId);
  }

  @Post('guests')
  createGuest(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateGuestDto,
  ) {
    return this.hospitalityService.createGuest(user.organizationId, user.id, dto);
  }

  @Patch('guests/:id')
  updateGuest(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateGuestDto,
  ) {
    return this.hospitalityService.updateGuest(id, user.organizationId, user.id, dto);
  }

  @Post('guests/:id/checkout')
  checkOutGuest(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.hospitalityService.checkOutGuest(id, user.organizationId, user.id);
  }

  @Get('rooms')
  findAllRooms(
    @CurrentUser('organizationId') organizationId: string,
    @Query('outletId') outletId?: string,
  ) {
    return this.hospitalityService.findAllRooms(outletId ?? '', organizationId);
  }

  @Post('rooms')
  createRoom(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateRoomDto,
  ) {
    return this.hospitalityService.createRoom(user.organizationId, user.id, dto);
  }

  @Patch('rooms/:id')
  updateRoom(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateRoomDto,
  ) {
    return this.hospitalityService.updateRoom(id, user.organizationId, user.id, dto);
  }

  @Post('room-postings')
  postToRoom(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: RoomPostingDto,
  ) {
    return this.hospitalityService.postToRoom(user.organizationId, user.id, {
      ...dto,
      checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
    });
  }

  @Post('room-postings/:id/settle')
  settleRoomPosting(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.hospitalityService.settleRoomPosting(id, user.organizationId, user.id);
  }

  @Get('banquet-events')
  findBanquetEvents(
    @CurrentUser('organizationId') organizationId: string,
    @Query('banquetId') banquetId?: string,
  ) {
    return this.hospitalityService.findBanquetEvents(organizationId, banquetId);
  }

  @Post('banquet-events')
  createBanquetEvent(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateBanquetEventDto,
  ) {
    return this.hospitalityService.createBanquetEvent(user.organizationId, user.id, {
      ...dto,
      eventDate: new Date(dto.eventDate),
    });
  }

  @Patch('banquet-events/:id/status')
  updateBanquetStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateBanquetStatusDto,
  ) {
    return this.hospitalityService.updateBanquetEventStatus(
      id,
      user.organizationId,
      user.id,
      dto.status,
    );
  }
}
