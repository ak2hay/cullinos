import { EMAIL_BRAND } from "./brand";
import { escapeHtml, plainTextToHtmlParagraphs } from "./escape";
import {
  bodyParagraph,
  ctaButton,
  mutedParagraph,
  wrapEmail,
} from "./layout";

export type OtpPurpose = "login_2fa" | "password_reset" | "labs_step_up";

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

function otpAction(purpose: OtpPurpose): string {
  if (purpose === "password_reset") return "reset your password";
  if (purpose === "labs_step_up") return "unlock Labs SQL for 10 minutes";
  return "complete your login";
}

function otpSubject(purpose: OtpPurpose): string {
  if (purpose === "password_reset") return "Your Cullinos password reset code";
  if (purpose === "labs_step_up") return "Your Cullinos Labs SQL verification code";
  return "Your Cullinos login verification code";
}

export function buildOtpEmail(code: string, purpose: OtpPurpose): RenderedEmail {
  const action = otpAction(purpose);
  const subject = otpSubject(purpose);
  const text = [
    `Your verification code is: ${code}`,
    "",
    `Enter this code to ${action}.`,
    "It expires in 10 minutes. If you did not request this, you can ignore this email.",
    "",
    "— Cullinos",
  ].join("\n");

  const bodyHtml = [
    bodyParagraph("Your verification code is:"),
    `<p style="margin:8px 0 20px;font-size:28px;font-weight:800;letter-spacing:6px;color:${EMAIL_BRAND.primary};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">${escapeHtml(code)}</p>`,
    bodyParagraph(`Enter this code to ${action}. It expires in 10 minutes.`),
    mutedParagraph("If you did not request this, you can ignore this email."),
  ].join("\n");

  return {
    subject,
    text,
    html: wrapEmail({
      title: "Verification code",
      preheader: `Your code is ${code}`,
      bodyHtml,
    }),
  };
}

export function buildSmtpTestEmail(): RenderedEmail {
  const subject = "Cullinos SMTP test";
  const text = [
    "This is a test email from Cullinos platform settings.",
    "If you received this, SMTP is connected and sending correctly.",
    "",
    "— Cullinos",
  ].join("\n");
  const bodyHtml = [
    bodyParagraph("This is a test email from Cullinos platform settings."),
    bodyParagraph("If you received this, SMTP is connected and sending correctly."),
  ].join("\n");
  return {
    subject,
    text,
    html: wrapEmail({
      title: "SMTP connection OK",
      preheader: "Cullinos SMTP test succeeded",
      bodyHtml,
    }),
  };
}

export function buildPromoEmail(
  subject: string,
  body: string,
  opts?: { unsubscribeUrl?: string },
): RenderedEmail {
  const unsub = opts?.unsubscribeUrl;
  const footerText = unsub
    ? `\n\n---\nYou are receiving this because you opted in to promotional emails. Unsubscribe: ${unsub}`
    : "";
  const footerHtml = unsub
    ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${EMAIL_BRAND.muted}">You are receiving this because you opted in to promotional emails. <a href="${escapeHtml(unsub)}" style="color:${EMAIL_BRAND.primary}">Unsubscribe</a></p>`
    : "";

  return {
    subject,
    text: `${body}${footerText}`,
    html: wrapEmail({
      preheader: body.split("\n").find((l) => l.trim())?.slice(0, 100),
      bodyHtml: plainTextToHtmlParagraphs(body),
      footerHtml,
    }),
  };
}

export function buildOwnerCredentialsEmail(input: {
  ownerName: string;
  restaurantName: string;
  email: string;
  temporaryPassword: string;
  adminUrl: string;
}): RenderedEmail {
  const subject = `Your Cullinos admin login for ${input.restaurantName}`;
  const text = [
    `Hi ${input.ownerName},`,
    "",
    `Your restaurant "${input.restaurantName}" has been onboarded on Cullinos.`,
    "",
    `Admin login: ${input.adminUrl}`,
    `Email: ${input.email}`,
    `Temporary password: ${input.temporaryPassword}`,
    "",
    "You must change this password on first login.",
    "",
    "— Cullinos / Rkyves",
  ].join("\n");

  const bodyHtml = [
    bodyParagraph(`Hi ${input.ownerName},`),
    bodyParagraph(
      `Your restaurant "${input.restaurantName}" has been onboarded on Cullinos.`,
    ),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:${EMAIL_BRAND.primarySoft};border-radius:12px;border:1px solid ${EMAIL_BRAND.border}">
      <tr><td style="padding:16px 18px">
        <p style="margin:0 0 8px;font-size:13px;color:${EMAIL_BRAND.muted}">Email</p>
        <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:${EMAIL_BRAND.ink}">${escapeHtml(input.email)}</p>
        <p style="margin:0 0 8px;font-size:13px;color:${EMAIL_BRAND.muted}">Temporary password</p>
        <p style="margin:0;font-size:15px;font-weight:700;letter-spacing:0.04em;color:${EMAIL_BRAND.primaryDeep};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">${escapeHtml(input.temporaryPassword)}</p>
      </td></tr>
    </table>`,
    ctaButton(input.adminUrl, "Open admin login"),
    mutedParagraph("You must change this password on first login."),
  ].join("\n");

  return {
    subject,
    text,
    html: wrapEmail({
      title: "Your admin access is ready",
      preheader: `Login details for ${input.restaurantName}`,
      bodyHtml,
    }),
  };
}

export function buildReservationInviteEmail(input: {
  customerName: string;
  outletName: string;
  bookUrl: string;
}): RenderedEmail {
  const subject = `You're invited to reserve a table at ${input.outletName}`;
  const text = [
    `Hi ${input.customerName},`,
    "",
    `You've been invited to book a table at ${input.outletName}.`,
    `Choose your slot: ${input.bookUrl}`,
    "",
    "— Cullinos",
  ].join("\n");

  const bodyHtml = [
    bodyParagraph(`Hi ${input.customerName},`),
    bodyParagraph(
      `You've been invited to book a table at ${input.outletName}.`,
    ),
    ctaButton(input.bookUrl, "Choose your slot"),
  ].join("\n");

  return {
    subject,
    text,
    html: wrapEmail({
      title: "Table reservation invite",
      preheader: `Book a table at ${input.outletName}`,
      bodyHtml,
    }),
  };
}

export function buildReservationConfirmationEmail(input: {
  customerName: string;
  outletName: string;
  when: string;
  partySize: number;
}): RenderedEmail {
  const subject = `Reservation confirmed — ${input.outletName}`;
  const text = [
    `Hi ${input.customerName},`,
    "",
    `Your reservation at ${input.outletName} is confirmed.`,
    `When: ${input.when}`,
    `Party size: ${input.partySize}`,
    "",
    "— Cullinos",
  ].join("\n");

  const bodyHtml = [
    bodyParagraph(`Hi ${input.customerName},`),
    bodyParagraph(
      `Your reservation at ${input.outletName} is confirmed.`,
    ),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:${EMAIL_BRAND.primarySoft};border-radius:12px;border:1px solid ${EMAIL_BRAND.border}">
      <tr><td style="padding:16px 18px">
        <p style="margin:0 0 6px;font-size:13px;color:${EMAIL_BRAND.muted}">When</p>
        <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:${EMAIL_BRAND.ink}">${escapeHtml(input.when)}</p>
        <p style="margin:0 0 6px;font-size:13px;color:${EMAIL_BRAND.muted}">Party size</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:${EMAIL_BRAND.ink}">${input.partySize}</p>
      </td></tr>
    </table>`,
  ].join("\n");

  return {
    subject,
    text,
    html: wrapEmail({
      title: "Reservation confirmed",
      preheader: `${input.outletName} · ${input.when}`,
      bodyHtml,
    }),
  };
}

export function buildReceiptEmail(input: {
  orderNumber: string;
  bodyText: string;
}): RenderedEmail {
  const subject = `Your receipt · #${input.orderNumber}`;
  return {
    subject,
    text: input.bodyText,
    html: wrapEmail({
      title: `Receipt #${input.orderNumber}`,
      preheader: `Your Cullinos receipt for order #${input.orderNumber}`,
      bodyHtml: plainTextToHtmlParagraphs(input.bodyText),
    }),
  };
}
