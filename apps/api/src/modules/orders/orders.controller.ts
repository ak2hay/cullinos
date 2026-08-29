import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { PERMISSIONS } from '@cullinos/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  AddOrderItemsDto,
  ApplyDiscountDto,
  CancelOrderDto,
  ListOrdersQueryDto,
} from './dto/orders.dto';

interface AuthUser {
  sub: string;
  organizationId: string;
}

@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ORDER_CREATE)
  createOrder(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.createOrder(user.organizationId, user.sub, dto, idempotencyKey);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ORDER_READ)
  listOrders(@CurrentUser() user: AuthUser, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.listOrders(user.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORDER_READ)
  getOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.getOrder(user.organizationId, id);
  }

  @Post(':id/confirm')
  @RequirePermissions(PERMISSIONS.ORDER_UPDATE)
  confirmOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.confirmOrder(user.organizationId, user.sub, id);
  }

  @Post(':id/hold')
  @RequirePermissions(PERMISSIONS.ORDER_UPDATE)
  holdOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.holdOrder(user.organizationId, user.sub, id);
  }

  @Post(':id/resume')
  @RequirePermissions(PERMISSIONS.ORDER_UPDATE)
  resumeOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.resumeOrder(user.organizationId, user.sub, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.ORDER_CANCEL)
  cancelOrder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(user.organizationId, user.sub, id, dto);
  }

  @Post(':id/complete')
  @RequirePermissions(PERMISSIONS.ORDER_UPDATE)
  completeOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.completeOrder(user.organizationId, user.sub, id);
  }

  @Post(':id/items')
  @RequirePermissions(PERMISSIONS.ORDER_UPDATE)
  addItems(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddOrderItemsDto,
  ) {
    return this.ordersService.addItems(user.organizationId, user.sub, id, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions(PERMISSIONS.ORDER_UPDATE)
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.ordersService.removeItem(user.organizationId, user.sub, id, itemId);
  }

  @Post(':id/discount')
  @RequirePermissions(PERMISSIONS.ORDER_DISCOUNT)
  applyDiscount(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ApplyDiscountDto,
  ) {
    return this.ordersService.applyDiscount(user.organizationId, user.sub, id, dto);
  }
}
