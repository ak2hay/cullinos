import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SuperAdminGuard } from './guards/super-admin.guard';
import {
  ManageSubscriptionDto,
  SuperAdminLoginDto,
  SuspendOrgDto,
} from './dto/super-admin.dto';
import { SuperAdminService } from './super-admin.service';

@Controller('super-admin')
export class SuperAdminController {
  constructor(private superAdminService: SuperAdminService) {}

  @Post('login')
  login(@Body() dto: SuperAdminLoginDto) {
    return this.superAdminService.login(dto);
  }

  @Get('organizations')
  @UseGuards(SuperAdminGuard)
  listOrganizations(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.superAdminService.listOrganizations(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch('organizations/:id/suspend')
  @UseGuards(SuperAdminGuard)
  suspend(@Param('id') id: string, @Body() dto: SuspendOrgDto) {
    return this.superAdminService.suspendOrganization(id, dto.reason);
  }

  @Patch('organizations/:id/activate')
  @UseGuards(SuperAdminGuard)
  activate(@Param('id') id: string) {
    return this.superAdminService.activateOrganization(id);
  }

  @Put('organizations/:id/subscription')
  @UseGuards(SuperAdminGuard)
  manageSubscription(@Param('id') id: string, @Body() dto: ManageSubscriptionDto) {
    return this.superAdminService.manageSubscription(id, dto);
  }

  @Get('health')
  @UseGuards(SuperAdminGuard)
  health() {
    return this.superAdminService.systemHealth();
  }
}
