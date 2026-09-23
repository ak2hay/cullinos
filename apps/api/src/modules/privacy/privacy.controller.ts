import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtService } from "@nestjs/jwt";
import { getJwtSecret } from "../../common/jwt-secret.util";
import type { Request } from "express";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, OrgId, Public } from "../../common/decorators";
import { DPDP_NOTICE_SUMMARY } from "./privacy.constants";
import { ConsentService } from "./consent.service";
import { CustomerPrivacyService } from "./customer-privacy.service";
import { GuestPrivacyService } from "./guest-privacy.service";
import { PrivacyRetentionService } from "./privacy-retention.service";
import { PrismaService } from "../../prisma/prisma.service";
import { hashHandoffCode } from "./privacy.crypto";

class MarketingPrefsDto {
  @IsOptional()
  @IsBoolean()
  marketingEmailOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingSmsOptIn?: boolean;
}

class ImpersonationExchangeDto {
  @IsString()
  @MinLength(16)
  code!: string;
}

@Controller()
export class PrivacyController {
  constructor(
    private customerPrivacy: CustomerPrivacyService,
    private guestPrivacy: GuestPrivacyService,
    private consent: ConsentService,
    private retention: PrivacyRetentionService,
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  @Public()
  @Get("public/privacy/notice")
  notice() {
    return DPDP_NOTICE_SUMMARY;
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get("public/privacy/unsubscribe")
  unsubscribeGet(@Query("token") token?: string) {
    if (!token?.trim()) throw new BadRequestException("token is required");
    return this.customerPrivacy.unsubscribeByToken(token);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("public/privacy/unsubscribe")
  unsubscribePost(@Body() body: { token?: string }) {
    if (!body.token?.trim()) throw new BadRequestException("token is required");
    return this.customerPrivacy.unsubscribeByToken(body.token);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("public/impersonation/exchange")
  async exchangeImpersonation(@Body() dto: ImpersonationExchangeDto) {
    const codeHash = hashHandoffCode(dto.code.trim());
    const handoff = await this.prisma.impersonationHandoff.findUnique({
      where: { codeHash },
    });
    if (!handoff || handoff.consumedAt) {
      throw new UnauthorizedException("Invalid or used handoff code");
    }
    if (handoff.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Handoff code expired");
    }

    await this.prisma.impersonationHandoff.update({
      where: { id: handoff.id },
      data: { consumedAt: new Date(), accessToken: "" },
    });

    return {
      accessToken: handoff.accessToken,
      expiresAt: handoff.expiresAt.toISOString(),
      organizationId: handoff.organizationId,
      targetUserId: handoff.targetUserId,
    };
  }

  @Public()
  @Get("public/auth/privacy")
  async customerPrivacyMe(@Headers("authorization") auth?: string) {
    const customer = await this.requireCustomer(auth);
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      marketingEmailOptIn: customer.marketingEmailOptIn,
      marketingSmsOptIn: customer.marketingSmsOptIn,
      notice: DPDP_NOTICE_SUMMARY,
    };
  }

  @Public()
  @Patch("public/auth/privacy/preferences")
  async updateCustomerPrefs(
    @Headers("authorization") auth: string | undefined,
    @Body() dto: MarketingPrefsDto,
    @Req() req: Request,
  ) {
    const customer = await this.requireCustomer(auth);
    const ip = req.ip;
    if (dto.marketingEmailOptIn !== undefined) {
      await this.customerPrivacy.setMarketingEmailOptIn(
        customer.organizationId,
        customer.id,
        dto.marketingEmailOptIn,
        "customer_preferences",
        { ipAddress: ip },
      );
    }
    if (dto.marketingSmsOptIn !== undefined) {
      await this.customerPrivacy.setMarketingSmsOptIn(
        customer.organizationId,
        customer.id,
        dto.marketingSmsOptIn,
        "customer_preferences",
        { ipAddress: ip },
      );
    }
    return this.customerPrivacyMe(auth);
  }

  @Public()
  @Get("public/auth/privacy/export")
  async exportSelf(@Headers("authorization") auth?: string) {
    const customer = await this.requireCustomer(auth);
    return this.customerPrivacy.exportCustomer(
      customer.organizationId,
      customer.id,
    );
  }

  @Public()
  @Delete("public/auth/privacy")
  async eraseSelf(@Headers("authorization") auth?: string) {
    const customer = await this.requireCustomer(auth);
    return this.customerPrivacy.eraseCustomer(
      customer.organizationId,
      customer.id,
    );
  }

  @Get("customers/:id/export")
  exportCustomer(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.customerPrivacy.exportCustomer(orgId, id, user.sub);
  }

  @Post("customers/:id/erase")
  eraseCustomer(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.customerPrivacy.eraseCustomer(orgId, id, user.sub);
  }

  @Get("customers/:id/consents")
  listConsents(@OrgId() orgId: string, @Param("id") id: string) {
    return this.consent.listForSubject(orgId, "customer", id);
  }

  @Post("hospitality/guests/:id/erase")
  eraseGuest(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.guestPrivacy.eraseGuest(orgId, id, user.sub);
  }

  @Post("internal/privacy/retention-run")
  runRetention(@Headers("x-internal-key") key?: string) {
    const expected = process.env.INTERNAL_API_KEY?.trim();
    if (!expected || key !== expected) {
      throw new UnauthorizedException("Invalid internal key");
    }
    return this.retention.runRetentionPass();
  }

  private async requireCustomer(auth?: string) {
    if (!auth?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing token");
    }
    try {
      const payload = this.jwt.verify(auth.slice(7), {
        secret: getJwtSecret(),
      }) as { sub: string; type?: string };
      if (payload.type !== "customer") {
        throw new UnauthorizedException("Not a customer token");
      }
      const customer = await this.prisma.customer.findUnique({
        where: { id: payload.sub },
      });
      if (!customer || customer.anonymizedAt) {
        throw new UnauthorizedException("Customer not found");
      }
      return customer;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Invalid token");
    }
  }
}
