import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PERMISSIONS } from '@cullinos/shared';
import { OutletsService } from './outlets.service';
import { CreateOutletDto, UpdateOutletDto } from './dto/outlet.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@ApiTags('outlets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('outlets')
export class OutletsController {
  constructor(private readonly outletsService: OutletsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.OUTLET_READ)
  @ApiOperation({ summary: 'List outlets' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.outletsService.findAll(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.OUTLET_READ)
  @ApiOperation({ summary: 'Get outlet by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.outletsService.findOne(id, user.organizationId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.OUTLET_CREATE)
  @ApiOperation({ summary: 'Create outlet' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOutletDto,
    @Req() req: Request,
  ) {
    return this.outletsService.create(user.organizationId, user.sub, dto, req.ip);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.OUTLET_UPDATE)
  @ApiOperation({ summary: 'Update outlet' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOutletDto,
    @Req() req: Request,
  ) {
    return this.outletsService.update(id, user.organizationId, user.sub, dto, req.ip);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.OUTLET_DELETE)
  @ApiOperation({ summary: 'Soft-delete outlet' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.outletsService.remove(id, user.organizationId, user.sub, req.ip);
  }
}
