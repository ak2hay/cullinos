export type RazorpaySubscriptionAuthResult = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type RazorpaySubscriptionCheckoutOptions = {
  key: string;
  subscription_id: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  handler: (response: RazorpaySubscriptionAuthResult) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (
    event: 'payment.failed',
    handler: (response: { error?: { description?: string } }) => void,
  ) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpaySubscriptionCheckoutOptions) => RazorpayInstance;
  }
}

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay Checkout'));
    document.body.appendChild(script);
  });
}

/** Open Standard Checkout for SaaS subscription auth (avoids hosted short_url pages). */
export async function openRazorpaySubscriptionCheckout(options: {
  keyId: string;
  subscriptionId: string;
  description?: string;
  prefill?: { name?: string | null; email?: string | null; contact?: string | null };
}): Promise<RazorpaySubscriptionAuthResult> {
  await loadCheckoutScript();
  const RazorpayCtor = window.Razorpay;
  if (!RazorpayCtor) {
    throw new Error('Razorpay Checkout is unavailable');
  }

  return new Promise((resolve, reject) => {
    const checkout = new RazorpayCtor({
      key: options.keyId,
      subscription_id: options.subscriptionId,
      name: 'Cullinos',
      description: options.description ?? 'Subscription payment',
      prefill: {
        name: options.prefill?.name ?? undefined,
        email: options.prefill?.email ?? undefined,
        contact: options.prefill?.contact ?? undefined,
      },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    });
    checkout.on('payment.failed', (response) => {
      const detail = response?.error?.description?.trim();
      reject(new Error(detail || 'Payment failed'));
    });
    checkout.open();
  });
}
