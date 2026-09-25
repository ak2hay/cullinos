export { EMAIL_BRAND } from "./brand";
export { escapeHtml, plainTextToHtmlParagraphs } from "./escape";
export { wrapEmail, ctaButton } from "./layout";
export {
  buildOtpEmail,
  buildSmtpTestEmail,
  buildPromoEmail,
  buildOwnerCredentialsEmail,
  buildReservationInviteEmail,
  buildReservationConfirmationEmail,
  buildReceiptEmail,
  type OtpPurpose,
  type RenderedEmail,
} from "./builders";
