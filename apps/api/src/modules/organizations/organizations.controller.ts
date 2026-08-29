import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PERMISSIONS } from '@cullinos/shared';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateOrganizationSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORG_READ)
  @ApiOperation({ summary: 'List organizations for current tenant' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findAll(user.organizationId);
  }

  @Get('settings')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE_SETTINGS, PERMISSIONS.SETTINGS_READ)
  @ApiOperation({ summary: 'Get organization settings' })
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.getSettings(user.organizationId, user.organizationId);
  }

  @Patch('settings')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE_SETTINGS, PERMISSIONS.SETTINGS_UPDATE)
  @ApiOperation({ summary: 'Update organization settings' })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationSettingsDto,
    @Req() req: Request,
  ) {
    return this.organizationsService.updateSettings(
      user.organizationId,
      user.organizationId,
      user.sub,
      dto,
      req.ip,
    );
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORG_READ)
  @ApiOperation({ summary: 'Get organization by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ORG_UPDATE)
  @ApiOperation({ summary: 'Update organization' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: Request,
  ) {
    return this.organizationsService.update(id, user.organizationId, user.sub, dto, req.ip);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ORG_UPDATE)
  @ApiOperation({ summary: 'Soft-delete organization' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.organizationsService.remove(id, user.organizationId, user.sub, req.ip);
  }
}
