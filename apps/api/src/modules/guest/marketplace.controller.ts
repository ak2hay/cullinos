import { Controller, Get, Param, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../common/decorators";
import { MarketplaceService } from "./marketplace.service";

@Controller("public/marketplace")
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class MarketplaceController {
  constructor(private service: MarketplaceService) {}

  @Public()
  @Get("nearby")
  nearby(
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
    @Query("radiusKm") radiusKm?: string,
    @Query("q") q?: string,
    @Query("cuisine") cuisine?: string,
    @Query("city") city?: string,
    @Query("limit") limit?: string,
    @Query("dineIn") dineIn?: string,
    @Query("takeaway") takeaway?: string,
    @Query("delivery") delivery?: string,
    @Query("veg") veg?: string,
    @Query("offersOnly") offersOnly?: string,
    @Query("openNow") openNow?: string,
  ) {
    return this.service.nearby({
      lat: lat != null && lat !== "" ? Number(lat) : undefined,
      lng: lng != null && lng !== "" ? Number(lng) : undefined,
      radiusKm: radiusKm != null ? Number(radiusKm) : undefined,
      q,
      cuisine,
      city,
      limit: limit != null ? Number(limit) : undefined,
      dineIn: dineIn === "1" || dineIn === "true",
      takeaway: takeaway === "1" || takeaway === "true",
      delivery: delivery === "1" || delivery === "true",
      veg: veg === "1" || veg === "true",
      offersOnly: offersOnly === "1" || offersOnly === "true",
      openNow: openNow === "1" || openNow === "true" ? true : undefined,
    });
  }

  @Public()
  @Get("banners")
  banners(
    @Query("orgIds") orgIds?: string,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
  ) {
    return this.service.banners({
      orgIds: orgIds
        ? orgIds.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
      lat: lat != null && lat !== "" ? Number(lat) : undefined,
      lng: lng != null && lng !== "" ? Number(lng) : undefined,
    });
  }

  @Public()
  @Get("offers")
  offers(
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.offers({
      lat: lat != null && lat !== "" ? Number(lat) : undefined,
      lng: lng != null && lng !== "" ? Number(lng) : undefined,
      limit: limit != null ? Number(limit) : undefined,
    });
  }

  @Public()
  @Get("specials")
  specials(
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.specials({
      lat: lat != null && lat !== "" ? Number(lat) : undefined,
      lng: lng != null && lng !== "" ? Number(lng) : undefined,
      limit: limit != null ? Number(limit) : undefined,
    });
  }

  @Public()
  @Get("outlets/:orgSlug/:outletSlug")
  outletProfile(
    @Param("orgSlug") orgSlug: string,
    @Param("outletSlug") outletSlug: string,
  ) {
    return this.service.outletProfile(orgSlug, outletSlug);
  }

  @Public()
  @Get("app-config")
  appConfig() {
    return this.service.appConfig();
  }

  @Public()
  @Get("discover-sections")
  discoverSections() {
    return this.service.discoverSections();
  }
}
