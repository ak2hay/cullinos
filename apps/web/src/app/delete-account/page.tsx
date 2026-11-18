import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { AccountDeletionForm } from '@/components/marketing/AccountDeletionForm';
import { BUSINESS_ADDRESS_LINE, BUSINESS_NAP } from '@/lib/business';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Delete account',
  description:
    'Request deletion of a Cullinos guest or staff account and the personal data we hold for it.',
  path: '/delete-account',
});

const mailto = `mailto:${BUSINESS_NAP.email}?subject=${encodeURIComponent('Account and data deletion request')}`;

export default function DeleteAccountPage() {
  return (
    <>
      <Hero
        eyebrow="Privacy"
        title="Delete your account"
        subtitle="Guests and restaurant staff can ask Rkyves to delete their Cullinos account and the personal data tied to it."
        primaryCta={{ label: `Email ${BUSINESS_NAP.email}`, href: mailto }}
        secondaryCta={{ label: 'Privacy policy', href: '/privacy' }}
      />
      <Section title="How deletion works">
        <div className="prose-marketing mx-auto max-w-3xl">
          <h2>Guest app</h2>
          <p>
            The Cullinos ordering app signs you in with your phone number. From the app, open Profile → Privacy
            &amp; legal → Delete account, or submit the form on this page. We confirm the request by email or
            phone, then anonymize the guest profile: name, phone, email, addresses, and device tokens. A restaurant
            may still have to keep an order record for tax; those records are kept without your personal details
            where the law allows that.
          </p>
          <p>
            There is no button in the app that deletes the account immediately. The request on this page is how we
            start it.
          </p>

          <h2>Restaurant staff</h2>
          <p>
            Staff logins are created by the restaurant. Email us from the address on the account, or have an owner
            submit the form with your name, work email, and restaurant. An organization admin can also turn off a
            staff login in the admin portal. Turning a login off, or removing it, does not by itself complete a
            personal-data deletion. Use this page for that request. We remove the staff profile we hold. Orders,
            bills, and the menu stay with the restaurant.
          </p>

          <h2>Closing a restaurant workspace</h2>
          <p>
            Cancelling the subscription stops future billing. See the{' '}
            <a href="/cancellation-policy">cancellation policy</a>. Deleting the organization&apos;s workspace is a
            separate request: say so in the form, from an owner email. Billing and security records may be kept for
            the period described in our <a href="/privacy">privacy policy</a>.
          </p>

          <h2>What to include</h2>
          <ul>
            <li>Your name</li>
            <li>The email or phone number on the account</li>
            <li>Whether this is a guest app account, a staff login, or the whole restaurant</li>
            <li>The restaurant name, if you have one</li>
          </ul>
          <p>
            You can also email{' '}
            <a href={mailto}>{BUSINESS_NAP.email}</a> with the same details. Operator: {BUSINESS_NAP.legalName},{' '}
            {BUSINESS_ADDRESS_LINE}.
          </p>
        </div>
      </Section>
      <Section title="Request deletion">
        <div className="mx-auto max-w-2xl">
          <AccountDeletionForm />
        </div>
      </Section>
    </>
  );
}
