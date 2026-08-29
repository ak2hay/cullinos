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
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
  roomNumber?: string;

  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateGuestDto extends CreateGuestDto {
  @IsOptional()
  @IsDateString()
  checkOutAt?: string;
}

class CreateRoomDto {
  @IsString()
  outletId!: string;

  @IsString()
  number!: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

class UpdateRoomDto {
  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class RoomPostingDto {
  @IsString()
  orderId!: string;

  @IsString()
  roomId!: string;

  @IsInt()
  @Min(1)
  amount!: number;
}

class CreateBanquetEventDto {
  @IsString()
  outletId!: string;

  @IsString()
  name!: string;

  @IsDateString()
  eventDate!: string;

  @IsInt()
  @Min(1)
  guestCount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateBanquetStatusDto {
  @IsString()
  status!: string;
}

@ApiTags('hospitality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
    return this.hospitalityService.createGuest(user.organizationId, user.id, {
      ...dto,
      checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : undefined,
    });
  }

  @Patch('guests/:id')
  updateGuest(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateGuestDto,
  ) {
    return this.hospitalityService.updateGuest(id, user.organizationId, user.id, {
      ...dto,
      checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : undefined,
      checkOutAt: dto.checkOutAt ? new Date(dto.checkOutAt) : undefined,
    });
  }

  @Post('guests/:id/checkout')
  checkOutGuest(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.hospitalityService.checkOutGuest(id, user.organizationId, user.id);
  }

  @Get('rooms')
  findAllRooms(@Query('outletId') outletId: string) {
    return this.hospitalityService.findAllRooms(outletId);
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
    return this.hospitalityService.postToRoom(user.organizationId, user.id, dto);
  }

  @Post('room-postings/:id/settle')
  settleRoomPosting(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.hospitalityService.settleRoomPosting(id, user.organizationId, user.id);
  }

  @Get('banquet-events')
  findBanquetEvents(@Query('outletId') outletId: string) {
    return this.hospitalityService.findBanquetEvents(outletId);
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
