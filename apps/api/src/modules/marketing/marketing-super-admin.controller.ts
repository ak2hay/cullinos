import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { SuperAdminGuard } from "./guards/super-admin.guard";
import { MarketingService } from "./marketing.service";

@Controller("super-admin/marketing")
@UseGuards(SuperAdminGuard)
export class MarketingSuperAdminController {
  constructor(private marketing: MarketingService) {}

  @Get("site")
  getSite() {
    return this.marketing.getSite();
  }

  @Patch("site")
  updateSite(@Body() body: Record<string, string>) {
    return this.marketing.updateSite(body);
  }

  @Get("assets")
  listAssets() {
    return this.marketing.listAssets();
  }

  @Post("assets/upload")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage() }))
  uploadAsset(
    @UploadedFile() file: Express.Multer.File,
    @Body("slotKey") slotKey?: string,
    @Body("alt") alt?: string,
  ) {
    return this.marketing.uploadAsset(file, slotKey, alt);
  }

  @Patch("assets/:id")
  updateAsset(@Param("id") id: string, @Body() body: { alt?: string; slotKey?: string; tags?: string[] }) {
    return this.marketing.updateAsset(id, body);
  }

  @Delete("assets/:id")
  deleteAsset(@Param("id") id: string) {
    return this.marketing.deleteAsset(id);
  }

  @Get("hero-slides")
  listHeroSlides(@Query("status") status?: "draft" | "published") {
    return this.marketing.listHeroSlides(status);
  }

  @Post("hero-slides")
  createHeroSlide(@Body() body: Record<string, unknown>) {
    return this.marketing.createHeroSlide(body as never);
  }

  @Patch("hero-slides/:id")
  updateHeroSlide(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.marketing.updateHeroSlide(id, body);
  }

  @Delete("hero-slides/:id")
  deleteHeroSlide(@Param("id") id: string) {
    return this.marketing.deleteHeroSlide(id);
  }

  @Get("nav")
  listNav(@Query("status") status?: "draft" | "published") {
    return this.marketing.listNavItems(status);
  }

  @Post("nav")
  createNav(@Body() body: Record<string, unknown>) {
    return this.marketing.createNavItem(body as never);
  }

  @Patch("nav/:id")
  updateNav(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.marketing.updateNavItem(id, body);
  }

  @Delete("nav/:id")
  deleteNav(@Param("id") id: string) {
    return this.marketing.deleteNavItem(id);
  }

  @Get("pricing")
  listPricing(@Query("status") status?: "draft" | "published") {
    return this.marketing.listPricingCards(status);
  }

  @Post("pricing")
  createPricing(@Body() body: Record<string, unknown>) {
    return this.marketing.createPricingCard(body);
  }

  @Patch("pricing/:id")
  updatePricing(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.marketing.updatePricingCard(id, body);
  }

  @Delete("pricing/:id")
  deletePricing(@Param("id") id: string) {
    return this.marketing.deletePricingCard(id);
  }

  @Get("testimonials")
  listTestimonials(@Query("status") status?: "draft" | "published") {
    return this.marketing.listTestimonials(status);
  }

  @Post("testimonials")
  createTestimonial(@Body() body: Record<string, unknown>) {
    return this.marketing.createTestimonial(body as never);
  }

  @Patch("testimonials/:id")
  updateTestimonial(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.marketing.updateTestimonial(id, body);
  }

  @Delete("testimonials/:id")
  deleteTestimonial(@Param("id") id: string) {
    return this.marketing.deleteTestimonial(id);
  }

  @Get("blog")
  listBlog(@Query("status") status?: "draft" | "published") {
    return this.marketing.listBlogPosts(status);
  }

  @Post("blog")
  createBlog(@Body() body: Record<string, unknown>) {
    return this.marketing.createBlogPost(body as never);
  }

  @Patch("blog/:id")
  updateBlog(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.marketing.updateBlogPost(id, body);
  }

  @Delete("blog/:id")
  deleteBlog(@Param("id") id: string) {
    return this.marketing.deleteBlogPost(id);
  }

  @Get("pages")
  listPages(@Query("status") status?: "draft" | "published") {
    return this.marketing.listPages(status);
  }

  @Put("pages/:slug/blocks/:blockKey")
  upsertBlock(
    @Param("slug") slug: string,
    @Param("blockKey") blockKey: string,
    @Body() body: { content: unknown; sortOrder?: number },
  ) {
    return this.marketing.upsertPageBlock(slug, blockKey, body.content, body.sortOrder);
  }

  @Get("theme")
  getTheme(@Query("status") status?: "draft" | "published") {
    return this.marketing.getTheme(status ?? "draft");
  }

  @Put("theme")
  upsertTheme(@Body() body: { tokens: Record<string, string>; name?: string }) {
    return this.marketing.upsertThemeDraft(body.tokens, body.name);
  }

  @Get("design-presets")
  listPresets() {
    return this.marketing.listDesignPresets();
  }

  @Post("design-presets/seed")
  seedPresets() {
    return this.marketing.seedDesignPresets();
  }

  @Post("design-presets/:slug/apply")
  applyPreset(@Param("slug") slug: string) {
    return this.marketing.applyDesignPreset(slug);
  }

  @Post("suggest/copy")
  suggestCopy(@Body() body: { page: string; tone: string }) {
    return this.marketing.suggestCopy(body.page, body.tone);
  }

  @Post("suggest/image-prompt")
  suggestImagePrompt(@Body() body: { slotKey: string; tone: string }) {
    return this.marketing.suggestImagePrompt(body.slotKey, body.tone);
  }

  @Post("publish")
  publish() {
    return this.marketing.publishAll();
  }

  @Post("preview-token")
  previewToken() {
    return { token: this.marketing.createPreviewToken() };
  }

  @Post("seed-from-code")
  seedFromCode() {
    return this.marketing.seedFromCode();
  }
}
