import { EMAIL_BRAND } from "./brand";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert plain text (newlines) into escaped HTML paragraphs. */
export function plainTextToHtmlParagraphs(body: string): string {
  return body
    .split("\n")
    .map((line) =>
      line.trim()
        ? `<p style="margin:0 0 12px;color:${EMAIL_BRAND.ink};font-size:15px;line-height:1.55">${escapeHtml(line)}</p>`
        : "<br/>",
    )
    .join("\n");
}
