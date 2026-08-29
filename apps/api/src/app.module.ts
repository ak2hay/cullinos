import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { BrandsModule } from './modules/brands/brands.module';
import { OutletsModule } from './modules/outlets/outlets.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { MenuModule } from './modules/menu/menu.module';
import { TablesModule } from './modules/tables/tables.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PosModule } from './modules/pos/pos.module';
import { KotModule } from './modules/kot/kot.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { BillingModule } from './modules/billing/billing.module';
import { TaxModule } from './modules/tax/tax.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { PurchasingModule } from './modules/purchasing/purchasing.module';
import { WastageModule } from './modules/wastage/wastage.module';
import { CustomersModule } from './modules/customers/customers.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { HospitalityModule } from './modules/hospitality/hospitality.module';
import { StaffModule } from './modules/staff/staff.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { SyncModule } from './modules/sync/sync.module';
import { DevicesModule } from './modules/devices/devices.module';
import { InsightsModule } from './modules/insights/insights.module';
import { FranchiseModule } from './modules/franchise/franchise.module';
import { HealthModule } from './modules/health/health.module';
import { EventsModule } from './events/events.module';
import { WebsocketModule } from './websocket/websocket.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EventsModule,
    WebsocketModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    BrandsModule,
    OutletsModule,
    UsersModule,
    RolesModule,
    MenuModule,
    TablesModule,
    OrdersModule,
    PosModule,
    KotModule,
    KitchenModule,
    PaymentsModule,
    BillingModule,
    TaxModule,
    InventoryModule,
    RecipesModule,
    PurchasingModule,
    WastageModule,
    CustomersModule,
    LoyaltyModule,
    CouponsModule,
    DeliveryModule,
    HospitalityModule,
    StaffModule,
    ReportsModule,
    AnalyticsModule,
    SubscriptionsModule,
    SuperAdminModule,
    NotificationsModule,
    IntegrationsModule,
    SyncModule,
    DevicesModule,
    InsightsModule,
    FranchiseModule,
    AuditModule,
  ],
})
export class AppModule {}
