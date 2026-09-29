/**
 * One-off: send a test email through Resend to verify RESEND_API_KEY.
 *
 * Usage: node apps/api/scripts/send-test-email.js --to <email>
 * Reads RESEND_API_KEY (and optional MAIL_FROM_EMAIL) from the repo-root .env.
 * With the default onboarding@resend.dev sender, Resend only delivers to the
 * email address that owns the Resend account.
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
const { Resend } = require("resend");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set. Add it to the repo-root .env file.");
    process.exit(1);
  }
  const to = arg("--to");
  if (!to) {
    console.error("Pass the recipient with --to <email>.");
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: process.env.MAIL_FROM_EMAIL || "onboarding@resend.dev",
    to,
    subject: "Hello World",
    html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
  });

  if (error) {
    console.error("Resend error:", error);
    process.exit(1);
  }
  console.log("Sent. Resend email id:", data.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
