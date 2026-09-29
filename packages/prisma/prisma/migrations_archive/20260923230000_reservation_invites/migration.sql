-- CreateEnum
CREATE TYPE "ReservationInviteStatus" AS ENUM ('sent', 'booked', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "reservation_invites" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "customer_email" TEXT,
    "token" TEXT NOT NULL,
    "status" "ReservationInviteStatus" NOT NULL DEFAULT 'sent',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "reservation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reservation_invites_token_key" ON "reservation_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_invites_reservation_id_key" ON "reservation_invites"("reservation_id");

-- CreateIndex
CREATE INDEX "reservation_invites_outlet_id_status_idx" ON "reservation_invites"("outlet_id", "status");

-- CreateIndex
CREATE INDEX "reservation_invites_organization_id_created_at_idx" ON "reservation_invites"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "reservation_invites" ADD CONSTRAINT "reservation_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_invites" ADD CONSTRAINT "reservation_invites_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_invites" ADD CONSTRAINT "reservation_invites_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
