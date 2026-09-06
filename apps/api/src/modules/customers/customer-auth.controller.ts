import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, randomInt } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { Public } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { Msg91Service } from "../sms/msg91.service";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

@Controller("public/auth")
export class CustomerAuthController {
  constructor(
    private prisma: PrismaService,
    private msg91: Msg91Service,
    private jwt: JwtService,
  ) {}

  @Public()
  @Post("otp/request")
  async requestOtp(@Body() body: { phone?: string; orgId?: string; organizationId?: string }) {
    const orgId = body.orgId ?? body.organizationId;
    const rawPhone = body.phone?.trim();
    if (!orgId || !rawPhone) {
      throw new BadRequestException("phone and orgId are required");
    }

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org || org.status === "suspended" || org.status === "cancelled") {
      throw new BadRequestException("Organization not available");
    }

    const phone = this.msg91.normalizePhone(rawPhone);
    if (phone.length < 10) {
      throw new BadRequestException("Invalid phone number");
    }

    const otp = String(randomInt(100000, 999999));
    const challengeToken = randomBytes(24).toString("hex");
    const ttl = this.msg91.otpTtlSeconds();
    const expiresAt = new Date(Date.now() + ttl * 1000);

    await this.prisma.phoneOtp.create({
      data: {
        phone,
        organizationId: orgId,
        codeHash: hashCode(otp),
        challengeToken,
        expiresAt,
      },
    });

    const send = await this.msg91.sendOtp(phone, otp);

    return {
      challengeToken,
      expiresIn: ttl,
      sent: send.sent,
      provider: send.provider,
      ...(send.provider === "log" && process.env.NODE_ENV !== "production"
        ? { debugOtp: otp }
        : {}),
    };
  }

  @Public()
  @Post("otp/verify")
  async verifyOtp(
    @Body()
    body: {
      challengeToken?: string;
      code?: string;
      name?: string;
    },
  ) {
    const token = body.challengeToken?.trim();
    const code = body.code?.trim();
    if (!token || !code) {
      throw new BadRequestException("challengeToken and code are required");
    }

    const challenge = await this.prisma.phoneOtp.findUnique({
      where: { challengeToken: token },
    });
    if (!challenge || challenge.consumedAt) {
      throw new UnauthorizedException("Invalid or expired OTP");
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("OTP expired");
    }
    if (challenge.attempts >= 5) {
      throw new UnauthorizedException("Too many attempts");
    }

    if (challenge.codeHash !== hashCode(code)) {
      await this.prisma.phoneOtp.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid OTP");
    }

    await this.prisma.phoneOtp.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    const displayPhone = challenge.phone.startsWith("91") && challenge.phone.length === 12
      ? challenge.phone.slice(2)
      : challenge.phone;

    let customer = await this.prisma.customer.findFirst({
      where: {
        organizationId: challenge.organizationId,
        phone: { in: [challenge.phone, displayPhone, `+${challenge.phone}`] },
      },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          organizationId: challenge.organizationId,
          phone: displayPhone,
          name: body.name?.trim() || `Guest ${displayPhone.slice(-4)}`,
        },
      });
    } else if (body.name?.trim() && customer.name.startsWith("Guest ")) {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: { name: body.name.trim() },
      });
    }

    const accessToken = this.jwt.sign(
      {
        sub: customer.id,
        type: "customer",
        orgId: challenge.organizationId,
        phone: customer.phone,
      },
      { expiresIn: "30d" },
    );

    return {
      accessToken,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        loyaltyPoints: customer.loyaltyPoints,
        stampCount: customer.stampCount,
      },
    };
  }

  @Public()
  @Get("me")
  async me(@Headers("authorization") auth?: string) {
    if (!auth?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing token");
    }
    try {
      const payload = this.jwt.verify(auth.slice(7), {
        secret: process.env.JWT_SECRET || "dev-secret",
      }) as { sub: string; type?: string };
      if (payload.type !== "customer") {
        throw new UnauthorizedException("Not a customer token");
      }
      const customer = await this.prisma.customer.findUnique({
        where: { id: payload.sub },
      });
      if (!customer) throw new UnauthorizedException("Customer not found");
      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        loyaltyPoints: customer.loyaltyPoints,
        stampCount: customer.stampCount,
        organizationId: customer.organizationId,
      };
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
