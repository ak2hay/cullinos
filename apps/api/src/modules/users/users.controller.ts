import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PERMISSIONS } from '@cullinos/shared';
import { UsersService } from './users.service';
import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORG_MANAGE_USERS, PERMISSIONS.STAFF_READ)
  @ApiOperation({ summary: 'List users' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(user.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE_USERS, PERMISSIONS.STAFF_READ)
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOne(id, user.organizationId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ORG_MANAGE_USERS, PERMISSIONS.STAFF_MANAGE)
  @ApiOperation({ summary: 'Create user' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserDto,
    @Req() req: Request,
  ) {
    return this.usersService.create(user.organizationId, user.sub, dto, req.ip);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE_USERS, PERMISSIONS.STAFF_MANAGE)
  @ApiOperation({ summary: 'Update user' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    return this.usersService.update(id, user.organizationId, user.sub, dto, req.ip);
  }
}
