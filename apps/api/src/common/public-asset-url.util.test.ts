import { describe, expect, it } from "vitest";
import {
  normalizePublicAssetUrl,
  resolveApiPublicOrigin,
  resolveMarketingPublicBaseUrl,
} from "./public-asset-url.util";

describe("public-asset-url.util", () => {
  it("resolves API origin from API_PUBLIC_URL", () => {
    expect(
      resolveApiPublicOrigin({
        API_PUBLIC_URL: "https://api.cullinos.com",
      }),
    ).toBe("https://api.cullinos.com");
  });

  it("strips /api/v1 from PUBLIC_API_URL", () => {
    expect(
      resolveApiPublicOrigin({
        PUBLIC_API_URL: "https://api.cullinos.com/api/v1",
      }),
    ).toBe("https://api.cullinos.com");
  });

  it("builds marketing base as origin/cms", () => {
    expect(
      resolveMarketingPublicBaseUrl({
        API_PUBLIC_URL: "https://api.cullinos.com",
      }),
    ).toBe("https://api.cullinos.com/cms");
  });

  it("prefers absolute MARKETING_PUBLIC_URL", () => {
    expect(
      resolveMarketingPublicBaseUrl({
        MARKETING_PUBLIC_URL: "https://cdn.example/cms",
        API_PUBLIC_URL: "https://api.cullinos.com",
      }),
    ).toBe("https://cdn.example/cms");
  });

  it("normalizes relative /cms paths", () => {
    expect(
      normalizePublicAssetUrl("/cms/menu-item-1.jpg", {
        API_PUBLIC_URL: "https://api.cullinos.com",
      }),
    ).toBe("https://api.cullinos.com/cms/menu-item-1.jpg");
  });

  it("leaves absolute URLs unchanged", () => {
    expect(
      normalizePublicAssetUrl("https://cdn.example/marketing/x.jpg", {
        API_PUBLIC_URL: "https://api.cullinos.com",
      }),
    ).toBe("https://cdn.example/marketing/x.jpg");
  });

  it("returns null for empty", () => {
    expect(normalizePublicAssetUrl(null)).toBeNull();
    expect(normalizePublicAssetUrl("  ")).toBeNull();
  });
});
