import { EMAIL_BRAND } from "./brand";
import { escapeHtml } from "./escape";

export type WrapEmailInput = {
  /** Optional heading shown above the body (inside the card). */
  title?: string;
  /** Hidden preheader for inbox preview. */
  preheader?: string;
  /** Already-safe HTML for the main content area. */
  bodyHtml: string;
  /** Extra footer HTML (e.g. unsubscribe). */
  footerHtml?: string;
};

/**
 * Table-based responsive Cullinos email shell.
 * Colors match guest marketplace green (#006D5B).
 */
export function wrapEmail(input: WrapEmailInput): string {
  const { primary, primaryDeep, ink, muted, border, surface, pageBg, wordmark, siteUrl, supportHint } =
    EMAIL_BRAND;

  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(input.preheader)}</div>`
    : "";

  const titleBlock = input.title
    ? `<h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:${ink};line-height:1.3">${escapeHtml(input.title)}</h1>`
    : "";

  const footerExtra = input.footerHtml ?? "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(wordmark)}</title>
</head>
<body style="margin:0;padding:0;background:${pageBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${pageBg};padding:24px 12px">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${surface};border-radius:16px;overflow:hidden;border:1px solid ${border}">
        <tr>
          <td style="background:${primary};padding:20px 28px">
            <a href="${escapeHtml(siteUrl)}" style="text-decoration:none;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.02em">${escapeHtml(wordmark)}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px">
            ${titleBlock}
            ${input.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 28px">
            <p style="margin:0;font-size:13px;line-height:1.5;color:${muted}">${escapeHtml(supportHint)}</p>
            ${footerExtra}
            <p style="margin:16px 0 0;font-size:12px;color:${muted}">— ${escapeHtml(wordmark)}</p>
          </td>
        </tr>
        <tr>
          <td style="background:${primaryDeep};padding:12px 28px;text-align:center">
            <a href="${escapeHtml(siteUrl)}" style="color:#E6F4F1;font-size:12px;text-decoration:none">${escapeHtml(siteUrl.replace(/^https?:\/\//, ""))}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function ctaButton(href: string, label: string): string {
  const { primary } = EMAIL_BRAND;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px">
  <tr>
    <td style="border-radius:999px;background:${primary}">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function mutedParagraph(text: string): string {
  return `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${EMAIL_BRAND.muted}">${escapeHtml(text)}</p>`;
}

export function bodyParagraph(htmlOrText: string, escaped = true): string {
  const content = escaped ? escapeHtml(htmlOrText) : htmlOrText;
  return `<p style="margin:0 0 12px;color:${EMAIL_BRAND.ink};font-size:15px;line-height:1.55">${content}</p>`;
}
