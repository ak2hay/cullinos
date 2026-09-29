import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { Public } from "../../common/decorators";
import { assertTurnstile } from "../../common/turnstile.util";
import { clientIp } from "../../common/client-ip.util";
import { MarketingService } from "./marketing.service";

/** The marketing site's server route verifies Turnstile itself, then forwards with the internal key. */
function isTrustedInternalCaller(key: string | undefined): boolean {
  const expected = process.env.INTERNAL_API_KEY?.trim();
  if (!expected || !key) return false;
  const a = createHash("sha256").update(key).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

@Controller("public/marketing")
export class MarketingPublicController {
  constructor(private marketing: MarketingService) {}

  @Public()
  @Get("site")
  async getSite(@Query("preview") previewToken?: string) {
    if (previewToken && this.marketing.verifyPreviewToken(previewToken)) {
      return this.marketing.getDraftBundle();
    }
    return this.marketing.getPublishedBundle();
  }

  @Public()
  @Get("blog")
  listBlog() {
    return this.marketing.listPublishedBlogPosts();
  }

  @Public()
  @Get("blog/:slug")
  getBlog(@Param("slug") slug: string) {
    return this.marketing.getPublishedBlogPost(slug);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("inquiries")
  async createInquiry(
    @Body()
    body: {
      name?: string;
      business?: string;
      email?: string;
      phone?: string;
      city?: string;
      outlets?: string;
      plan?: string;
      message?: string;
      captchaToken?: string;
    },
    @Req() req: Request,
    @Headers("x-internal-key") internalKey?: string,
  ) {
    if (!body.name?.trim() || !body.business?.trim() || !body.email?.trim() || !body.message?.trim()) {
      throw new BadRequestException("name, business, email, and message are required");
    }
    if (!isTrustedInternalCaller(internalKey)) {
      await assertTurnstile(body.captchaToken, clientIp(req));
    }
    return this.marketing.createInquiry({
      name: body.name,
      business: body.business,
      email: body.email,
      phone: body.phone,
      city: body.city,
      outlets: body.outlets,
      planInterest: body.plan,
      message: body.message,
    });
  }
}
