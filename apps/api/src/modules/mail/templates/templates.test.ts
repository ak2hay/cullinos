import { describe, expect, it } from "vitest";
import { escapeHtml } from "./escape";
import { wrapEmail } from "./layout";
import { buildOtpEmail, buildOwnerCredentialsEmail } from "./builders";
import { EMAIL_BRAND } from "./brand";

describe("email templates", () => {
  it("escapeHtml escapes markup", () => {
    expect(escapeHtml(`<a href="x">a&b</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;a&amp;b&lt;/a&gt;",
    );
  });

  it("wrapEmail includes Cullinos brand shell", () => {
    const html = wrapEmail({
      title: "Hello",
      preheader: "preview",
      bodyHtml: "<p>Body</p>",
    });
    expect(html).toContain(EMAIL_BRAND.primary);
    expect(html).toContain("Cullinos");
    expect(html).toContain("Hello");
    expect(html).toContain("Body");
    expect(html).toContain("preview");
  });

  it("buildOtpEmail renders code and purpose", () => {
    const { subject, text, html } = buildOtpEmail("123456", "login_2fa");
    expect(subject).toMatch(/login verification/i);
    expect(text).toContain("123456");
    expect(html).toContain("123456");
    expect(html).toContain(EMAIL_BRAND.primary);
    expect(html).toContain("complete your login");
  });

  it("buildOwnerCredentialsEmail escapes user input", () => {
    const { html, text } = buildOwnerCredentialsEmail({
      ownerName: `Alice <script>`,
      restaurantName: `Bob's "Cafe"`,
      email: "alice@example.com",
      temporaryPassword: "Tmp!234",
      adminUrl: "https://admin.cullinos.com",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("Alice &lt;script&gt;");
    expect(html).toContain("Open admin login");
    expect(text).toContain("alice@example.com");
    expect(text).toContain("Tmp!234");
  });
});
