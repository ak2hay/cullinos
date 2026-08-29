import { Controller, Get, Param, Query } from "@nestjs/common";
import { Public } from "../../common/decorators";
import { MarketingService } from "./marketing.service";

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
}
