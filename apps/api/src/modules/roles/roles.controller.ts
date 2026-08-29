import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PERMISSIONS } from '@cullinos/shared';
import { RolesService } from './roles.service';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORG_MANAGE_SETTINGS, PERMISSIONS.ORG_READ)
  @ApiOperation({ summary: 'List roles' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.findAll(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE_SETTINGS, PERMISSIONS.ORG_READ)
  @ApiOperation({ summary: 'Get role by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.findOne(id, user.organizationId);
  }

  @Put(':id/permissions')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE_SETTINGS)
  @ApiOperation({ summary: 'Assign permissions to role' })
  assignPermissions(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignPermissionsDto,
    @Req() req: Request,
  ) {
    return this.rolesService.assignPermissions(
      id,
      user.organizationId,
      user.sub,
      dto,
      req.ip,
    );
  }
}
