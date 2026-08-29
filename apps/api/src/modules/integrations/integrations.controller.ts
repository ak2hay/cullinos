import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FEATURES } from '@cullinos/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ConfigureProviderDto,
  CreateWebhookDto,
  UpdateWebhookDto,
} from './dto/integrations.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard, FeatureGuard)
@RequireFeature(FEATURES.API_ACCESS)
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  @Get('providers/catalog')
  catalog() {
    return this.integrationsService.listProviderCatalog();
  }

  @Get('providers')
  listProviders(@CurrentUser('organizationId') orgId: string) {
    return this.integrationsService.listProviders(orgId);
  }

  @Post('providers')
  configureProvider(@CurrentUser('organizationId') orgId: string, @Body() dto: ConfigureProviderDto) {
    return this.integrationsService.configureProvider(orgId, dto);
  }

  @Get('webhooks')
  listWebhooks(@CurrentUser('organizationId') orgId: string) {
    return this.integrationsService.listWebhooks(orgId);
  }

  @Post('webhooks')
  createWebhook(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateWebhookDto) {
    return this.integrationsService.createWebhook(orgId, dto);
  }

  @Patch('webhooks/:id')
  updateWebhook(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.integrationsService.updateWebhook(orgId, id, dto);
  }

  @Delete('webhooks/:id')
  deleteWebhook(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.integrationsService.deleteWebhook(orgId, id);
  }
}
