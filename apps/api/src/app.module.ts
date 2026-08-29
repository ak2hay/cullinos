import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { BrandsModule } from "./modules/brands/brands.module";
import { OutletsModule } from "./modules/outlets/outlets.module";
import { UsersModule } from "./modules/users/users.module";
import { RolesModule } from "./modules/roles/roles.module";
import { AuditModule } from "./modules/audit/audit.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { MenuModule } from "./modules/menu/menu.module";
import { TablesModule } from "./modules/tables/tables.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PosModule } from "./modules/pos/pos.module";
import { KotModule } from "./modules/kot/kot.module";
import { KitchenModule } from "./modules/kitchen/kitchen.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { BillingModule } from "./modules/billing/billing.module";
import { TaxModule } from "./modules/tax/tax.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { RecipesModule } from "./modules/recipes/recipes.module";
import { PurchasingModule } from "./modules/purchasing/purchasing.module";
import { WastageModule } from "./modules/wastage/wastage.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { LoyaltyModule } from "./modules/loyalty/loyalty.module";
import { CouponsModule } from "./modules/coupons/coupons.module";
import { DeliveryModule } from "./modules/delivery/delivery.module";
import { GuestsModule } from "./modules/guests/guests.module";
import { RoomsModule } from "./modules/rooms/rooms.module";
import { BanquetsModule } from "./modules/banquets/banquets.module";
import { FranchiseModule } from "./modules/franchise/franchise.module";
import { StaffModule } from "./modules/staff/staff.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { InsightsModule } from "./modules/insights/insights.module";
import { SuperAdminModule } from "./modules/super-admin/super-admin.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { DevicesModule } from "./modules/devices/devices.module";
import { SyncModule } from "./modules/sync/sync.module";
import { WebsocketModule } from "./websocket/websocket.module";
import { InternalModule } from "./modules/internal/internal.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    BrandsModule,
    OutletsModule,
    UsersModule,
    RolesModule,
    AuditModule,
    SubscriptionsModule,
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
    GuestsModule,
    RoomsModule,
    BanquetsModule,
    FranchiseModule,
    StaffModule,
    ReportsModule,
    AnalyticsModule,
    InsightsModule,
    SuperAdminModule,
    NotificationsModule,
    IntegrationsModule,
    DevicesModule,
    SyncModule,
    WebsocketModule,
    InternalModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
